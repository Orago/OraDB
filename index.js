const {
  set,
  get,
  unset
} = require('lodash');

const sqlite3 = require('better-sqlite3');

const BSON = require('bson');

let parseKeys = ({ keys = {}, joint = ', ', pre = 'ID' }) => {
  let cleanKey = k => k.replace(/[^a-zA-Z0-9]/g, ''),
      data = {};

  Object.keys(keys).forEach(key => {
    data[pre + cleanKey(key)] = keys[key];
  });

  return {
    string: (
      Object
      .keys(keys)
      .map(cleanKey)
      .map( key => `${key} = @${pre}${key}` )
      .join(joint)
    ),
    data
  }
}

const defaultHandlers = {
	TEXT: {
		parse: input => input,
		stringify: input => input
	},
  JSON: {
    parse: input => {
      try { return JSON.parse(input); }
      catch (e) { return {} }
    },
    stringify: input => JSON.stringify(input)
  },
  BSON: {
		parse: input => BSON.deserialize( Buffer.from(input, 'base64') ),
		stringify: input => (BSON.serialize(input)).toString('base64')
	} 
};

const parseWhereKeys = str => (str.length > 0 ? 'WHERE ' : '') + str;

const parseRows = (columnData, handlers) => async (...rows) => {
	const getCol = name => columnData.find($ => $.name == name);
	const resultRows = [];

	for (let rowData of rows){
		const newData = {};

		for (let column of Object.keys(rowData)){
			const columnType = getCol(column)?.type  || 'TEXT';
			const { parse } = handlers?.[columnType] || {};
	
			newData[column] = typeof parse == 'function' ? await parse(rowData[column]): rowData[column];
		}

		resultRows.push(newData);
	}

	return resultRows;
}

class OraDBTable {
  constructor ({ database, table, handlers }){
    this.database = database;
    this.table = table;
    this.handlers = handlers;
  }
  
  columns = {
    getAll: async () => await this.database.pragma(`table_info(${ this.table });`),
		
		list: async () => ( await this.columns.getAll() ).map(col => col.name),
    
		get: async columnName => ( await this.columns.getAll() ).find(columnData => columnData.name === columnName),
    
		has: async columnName => await this.columns.get(columnName) !== undefined ? true : false,
    
		rename: async({ column, to }) => {
      let { table, columns, database } = this;
  
      if (table == undefined)
				console.error('@SqliteDriverTable.columns.remove: Missing Table');

      if (column == undefined)
				console.error('@SqliteDriverTable.columns.remove: Missing Column');
  
      if (!await columns.has(column))
				return console.log(`ending cause col doesnt exist ${column}`);

      return database.prepare(`ALTER TABLE ${ table } RENAME COLUMN ${column} TO ${to};`).run();
    },

		update: async (columns) => {
      const list = await this.columns.list();

			for (let [columnName, type = 'TEXT'] of Object.entries(columns)){
        const column = { [columnName]: type };

        const getCol = await this.columns.get(columnName)

        if (list.includes(columnName) && (getCol.name != columnName || getCol.type != type)){
          await this.columns.remove(column);
					await this.columns.add(column);
        }
				else await this.columns.add(column);
			}
		},

    addOrRemove: async ({ columns, mode = true } = {}) => {
      const { table, database } = this;

      if (table == undefined) 
				console.error('@SqliteDriverTable.columns.add: Missing Table');

      if (columns == undefined)
				console.error('@SqliteDriverTable.columns.add: Missing Columns');

      const list = await this.columns.list();

      const _addColumn = async (columnName, type) => {
        return await database.prepare(`ALTER TABLE ${ table } ADD COLUMN ${ columnName } ${ type?.toUpperCase() }`).run();
      }
      
      const _removeColumn = async columnName => {
        return await database.prepare(`ALTER TABLE ${ table } DROP COLUMN ${ columnName };`).run();
      }

      for (const column of columns){
        const [columnName, type = 'TEXT'] = Object.entries(column)[0];

        if (mode && !list.includes(columnName))
            _addColumn(columnName, type);
            
        else if (!mode && list.includes(columnName))
          _removeColumn(columnName)
      }
    },

    add: async (...columns) => {
      return this.columns.addOrRemove({ columns, mode: true });
    },
    
		remove: async (...columns) => {
      return this.columns.addOrRemove({ columns, mode: false });
    }
  }

  row = {
		has: async ({ where }) => {
      return await this.row.get({ column: Object.keys(where)[0], where }) != null;
    },
    
		count: async () => {
      const { database, table } = this;

      return await database.prepare(`SELECT Count(*) FROM ${table}`).get()['Count(*)'];
    },
    
		getData: async ({ columns = [], where = {}, limit, order } = {}) => {
      const { database, table } = this;
      const columnList      = await this.columns.list();
      const validColumns = columns.filter(col => columnList.includes(col));
      const whereKeys       = parseKeys({ keys: where, pre: 'WHERE', joint: ' AND ' });

			if (typeof limit !== 'number') limit = 1;

			let stmt;
			
			{
				let __cols = validColumns.length > 0 ? validColumns.join(', ') : '*',
						__where = parseWhereKeys(whereKeys.string),
						__limit = `limit ${limit}`,
						__order = '';
				console.log(__cols)

				if (typeof order == 'object'){
					__order = (
						`ORDER BY ${
							Object
							.entries(order)
							.map(columnPair => {
								let [key = 'id', direction] = columnPair || [];

								if (!['ASC', 'DESC'].includes(direction?.toUpperCase()))
									direction = 'ASC'

								return `${key} ${direction}`;
							})
							.join(',')
						}`
					);
				}
		

				stmt = `SELECT ${__cols} FROM ${table} ${__where} ${__order} ${__limit};`;
			}
			
      return await database.prepare(stmt).all(whereKeys.data);
    },
    
		
		getDataParsed: async (args) =>  {
      const data = await this.row.getData(args);
			if (data == undefined) return;

			const parsed = await parseRows(
				await this.columns.getAll(),
				this.handlers
			)(...data);

			return args?.limit == undefined ? parsed?.[0] : parsed;
    },
    
		get: async ({ column, where, path }) => {
      const { database, table } = this;
      const whereKeys = parseKeys({
				keys: where,
				pre: 'WHERE',
				joint: ' AND '
			});
			
			const statement = `SELECT ${column} FROM ${table} ${parseWhereKeys(whereKeys.string)};`;
      const value = await database.prepare(statement).get(whereKeys.data);
      const columnType = ( await this.columns.get(column) )?.type || 'TEXT';

      if (value?.[column] == undefined)
				return;

      else if (this.handlers.hasOwnProperty(columnType)){
				const data = await this.handlers[columnType].parse(value?.[column]);

				return path != undefined && typeof data == 'object' ? get(data, path) : data;
			}
      else return value?.[column];
    },
		
		JSON: async ({ column, path, where }) => {
			const columnData = await this.columns.get(column);

			if (columnData?.type != 'JSON'){
				console.error(`@SqliteDriverTable.row.updateJSON: Invalid Column Type For (${ column })`);

				return false;
      }

			if (path  == undefined)
				console.error('@SqliteDriverTable.row.updateJSON: Missing Path');

  		let getObj = await this.row.get({
				column,
				where
			});
			
			let obj = getObj instanceof Object == true ? getObj : {};

			const sendUpdate = async data => {
				return await this.row.setValues({
					columns: { [column]: data },
					where
				});
			}

			let addSub = async (amount = 0) => {
				const getCurrent = get(obj, path);
				const current = typeof getCurrent == 'number' ? getCurrent : 0;
				
				await sendUpdate(
					set(obj ?? {}, path, current + amount)
				);
			}

			return {
				get: async () => get(obj, path),
				
				update: async value => await sendUpdate(
					set(obj ?? {}, path, value)
				),
				
				add: addSub,
				
				subtract: amount => addSub(-amount),
				
				push: async (...items) => {
					const getList = get(obj, path);
					const list = (
						Array.isArray(getList) ? getList : []
					).concat(...items);

					await sendUpdate(
						set(obj ?? {}, path, list)
					)
				},
				
				pull: async (...remove) => {
					const getList = get(obj, path);
					const list = Array.isArray(getList) ? getList : [];

					if (!Array.isArray(remove))
						remove = [];

					await sendUpdate(
						set(
							obj ?? {},
							path,
							list.filter(value => !remove.includes(value))
						)
					);
				},
				
				delete: async () => {
          if (path == undefined) this.row.delete({ where });
          else await sendUpdate(
						unset(obj ?? {}, path)
					);
				}
			}
		},
    
		delete: async ({ where }) => {
      const { database, table } = this;
      const whereKeys = parseKeys({
				keys: where,
				pre: 'WHERE',
				joint: ' AND '
			});

      return (
        database
        .prepare(`DELETE FROM ${table} WHERE ${whereKeys.string}`)
        .run(whereKeys.data)
        .changes
      );
    },
    
		setValues: async (args) => {
      const { database, table, handlers } = this;
      const { where, columns } = args;

			const allColumns = await this.columns.getAll();
      const entryExists = await this.row.has({ where });

			for (const column of Object.keys(columns)){
				const columnData = allColumns.find(col => col.name == column);
				const { type } = columnData;

				if (
					columnData != undefined &&
					handlers?.[type]?.stringify
				){
					columns[column] = await handlers[type].stringify(columns[column]);
				}
				else delete columns[column];
			}
			
			if (Object.keys(columns).length == 0)
				return;

      if (entryExists){
        const columnKeys = parseKeys({
					keys: columns,
					pre: 'COL'
				});

        const whereKeys  = parseKeys({
					keys: where,
					pre: 'WHERE',
					joint: ' AND '
				});

        let statement = `UPDATE ${table} SET ${columnKeys.string} ${parseWhereKeys(whereKeys.string)};;`;
        
        await database.prepare(statement).run({
					...columnKeys.data,
					...whereKeys.data
				});
      }
      else {
				const valFix = Object.keys(columns).map($ => `@${$}`).toString();
        let statement = `INSERT INTO ${table} (${Object.keys(columns)}) values (${valFix})`;

        await database.prepare(statement).run(columns);
      }
    }
  }
}

class OraDB {
  constructor ({ path = "db.sqlite", handlers = {} }){
    this.path = path
    this.database = sqlite3(path);
    this.handlers = {
      ...defaultHandlers,
      ...handlers
    }
  }

	flags = {
		order: {
			asc:       'ASC',
			ascending: 'ASC',
			desc:       'DESC',
			descending: 'DESC'
		}
	}

  async prepareTable ({ table, columns = { id: 'TEXT', data: 'JSON' } }){
    let columnTypes = (
      Object
      .entries(columns)
      .map(e => e.join(' '))
      .join(', ')
    );

		

    this.database.prepare(`CREATE TABLE IF NOT EXISTS ${ table } (${ columnTypes })`).run();
  }

  openTable ({ table, columns }){
		const { database, handlers } = this;
		
    this.prepareTable({ table, columns });
    
    return new OraDBTable({
      database,
      handlers,
      table
    });
  }

  async dropTable ({ table }){
    return (
			this
			.database
			.prepare(`DROP TABLE ${ table };`)
		);
  }

  async deleteAllRows ({ table }){
    return (
			this
			.database
			.prepare(`DELETE FROM ${ table }`)
			.run()
			.changes
		);
  }
}

module.exports = OraDB;