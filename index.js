const {
  set,
  get,
  unset
} = require("lodash");

const sqlite3 = require("better-sqlite3");

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

class OraDBTable {
  constructor ({ database, table, handlers }){
    this.database = database;
    this.table = table;
    this.handlers = handlers;
  }
  
  columns = {
    getAll: async () => {
      return this.database.pragma(`table_info(${ this.table });`)
    },
    list: async function () {
      return ( await this.getAll() ).map(col => col.name);
    },
    get: async function (column) {
      return ( await this.getAll() ).find(columnData => columnData.name === column);
    },
    has: async function (column) {
      return await this.get(column) !== undefined ? true : false;
    },
    rename: async({ column, to }) => {
      let { table, columns, database } = this;
  
      if (table  == undefined) console.error('@SqliteDriverTable.columns.remove: Missing Table');
      if (column == undefined) console.error('@SqliteDriverTable.columns.remove: Missing Column');
  
      if (!await columns.has(column)) return console.log(`ending cause col doesnt exist ${column}`);
      else return database.prepare(`ALTER TABLE ${ table } RENAME COLUMN ${column} TO ${to};`).run();
    },
    add: async (...columns) => {
      let { table, database } = this;

      if (table  == undefined)  console.error('@SqliteDriverTable.columns.add: Missing Table');
      if (columns == undefined) console.error('@SqliteDriverTable.columns.add: Missing Columns');

      let list = await this.columns.list();

      for (let columnData of columns){
        let { column, type = 'TEXT' } = columnData;
        
        if (!list.includes(column)){
          if (await this.columns.has(column)) console.log(`ending cause col exists ${column}`);
          else database.prepare(`ALTER TABLE ${ table } ADD COLUMN ${ column } ${ type.toUpperCase() }`).run();
        }
      }
    },
    remove: async (...columns) => {
      let { table, database } = this;
      if (table  == undefined)  console.error('@SqliteDriverTable.columns.remove: Missing Table');
      if (columns == undefined) console.error('@SqliteDriverTable.columns.remove: Missing Column');

      let list = await this.columns.list();

      for (let column of columns)
        if (list.includes(column))
          database.prepare(`ALTER TABLE ${table} DROP COLUMN ${column};`).run();
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
    getData: async ({ columns = [], where = {}, limit } = {}) => {
      const { database, table } = this;
      const columnList      = await this.columns.list();
      const columnsFiltered = columns.filter(col => columnList.includes(col));
      const whereKeys       = parseKeys({ keys: where, pre: 'WHERE', joint: ' AND ' });

			if (typeof limit !== 'number') limit = 1;

			const str = {
				cols: columnsFiltered.length > 0 ? columnsFiltered.join(', ') : '*',
				where: parseWhereKeys(whereKeys.string),
				limit: `limit ${limit}`
			}

			const stmt = `SELECT ${str.cols} FROM ${table} ${str.where} ${str.limit};`;

      return await database.prepare(stmt).all(whereKeys.data);
    },
    getDataParsed: async (args) =>  {
      const data = (await this.row.getData({ ...args, limit: 1 }))[0];
      const newData = {};

      for (let column of Object.keys(data)){
        let type = (await this.columns.get(column))?.type || 'TEXT';
				
        if (typeof this.handlers[type]?.parse == 'function')
					newData[column] = await this.handlers[type].parse(data[column]);
				
        else
					newData[column] = data[column];
      }

      return newData;
    },
    get: async ({ column, where, path }) => {
      const { database, table } = this;
      const whereKeys = parseKeys({ keys: where, pre: 'WHERE', joint: ' AND ' });
			const statement = `SELECT ${column} FROM ${table} ${parseWhereKeys(whereKeys.string)};`;
      const value = await database.prepare(statement).get(whereKeys.data);
      const columnType = ( await this.columns.get(column) )?.type || 'TEXT';

      if (value?.[column] == undefined) return;

      else if (this.handlers.hasOwnProperty(columnType)){
				let data = await this.handlers[columnType].parse(value?.[column]);
				if (path != undefined)
					return get(data, path);
				else return data;
			}
      else return value?.[column];
    },
		JSON: async ({ column, path,  where }) => {
			const columnData = await this.columns.get(column);

			if (columnData?.type != 'JSON') return console.error(`@SqliteDriverTable.row.updateJSON: Invalid Column Type For (${ column })`);
      if (path  == undefined) console.error('@SqliteDriverTable.row.updateJSON: Missing Path');

  		let obj = await this.row.get({ column, where });

			if (obj instanceof Object == false) obj = {};

			let send = async data => await this.row.setValues({
				columns: {
					[column]: data
				},
				where
			});

			let addSub = async (second = 0) => {
				let first = get(obj, path);

				if (typeof first != 'number') first = 0;

				set(obj ?? {}, path, first + second);

				await send(obj);
			}

			return {
				get: async () => get(obj, path),
				update: async value => {
					set(obj ?? {}, path, value);

					await send(obj);
				},
				add: addSub,
				subtract: second => addSub(-second),
				push: async (...items) => {
					let list = get(obj, path);
					if (!Array.isArray(list)) list = [];
					
					list.push(...items);
	
					set(obj ?? {}, path, list);

					await send(obj)
				},
				pull: async (...remove) => {
					let list = get(obj, path);
					if (!Array.isArray(list)) list = [];
					if (!Array.isArray(remove)) remove = [];
					
					list = list.filter(value => !remove.includes(value));
	
					set(obj ?? {}, path, list);

					await send(obj);
				},
				delete: async () => {
					unset(obj ?? {}, path);

          if (path == undefined) this.row.delete({ where });
          else await send(obj);
				}
			}
		},
    delete: async ({ where }) => {
      const { database, table } = this;
      const whereKeys = parseKeys({ keys: where, pre: 'WHERE', joint: ' AND ' });

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
      const columnList = await this.columns.list();
      const entryExists = await this.row.has({ where });

			for (const column of Object.keys(columns)){
				const columnData = allColumns.find(col => col.name == column),
							{ type } = columnData;

				if (columnData != undefined && handlers?.[type]?.stringify){
						columns[column] = await handlers[type].stringify(columns[column]);
				}
				else delete columns[column];
			}
			
			if (Object.keys(columns).length == 0) return;

      if (entryExists){
        let columnKeys = parseKeys({ keys: columns, pre: 'COL' }),
            whereKeys  = parseKeys({ keys: where, pre: 'WHERE', joint: ' AND ' });

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
    this.prepareTable({ table, columns });
    
    return new OraDBTable({
      database: this.database,
      handlers: this.handlers,
      table
    });
  }

  async dropTable ({ table }){
    return this.database.prepare(`DROP TABLE ${ table };`);
  }

  async deleteAllRows ({ table }){
    return this.database.prepare(`DELETE FROM ${ table }`).run().changes;
  }
}

module.exports = OraDB;