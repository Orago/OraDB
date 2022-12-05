// import lodash from 'lodash';
// import sqlite3 from 'better-sqlite3';
// import BSON from 'bson';

const BSON = require('bson');
const lodash = require('lodash');
const sqlite3 = require('better-sqlite3')

let { set, get, unset } = lodash;

let parseKeys = ({ keys = [], joint = ', ', pre = 'ID' }) => {
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
			const columnType = getCol(column)?.type || 'TEXT';
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
    getAll: async () =>    await this.database.pragma(`table_info(${ this.table });`),
		list: async () =>    ( await this.columns.getAll() ).map( columnData => columnData.name),
    get: async columnName => ( await this.columns.getAll() ).find(columnData => columnData.name === columnName),
    has: async columnName =>   await this.columns.get(columnName) !== undefined ? true : false,
    rename: async({ column, to }) => {
      const { table, columns, database } = this;
  
      if (table  == undefined)
				console.error('@SqliteDriverTable.columns.remove: Missing Table');

      if (column == undefined)
				console.error('@SqliteDriverTable.columns.remove: Missing Column');
  
      if (!await columns.has(column)) return console.log(`ending cause col doesnt exist ${column}`);
      else return database.prepare(`ALTER TABLE ${ table } RENAME COLUMN ${column} TO ${to};`).run();
    },
    add: async (...columns) => {
      let { table, database } = this;

      if (table   == undefined)
				console.error('@SqliteDriverTable.columns.add: Missing Table');

      if (columns == undefined)
				console.error('@SqliteDriverTable.columns.add: Missing Columns');

      let list = await this.columns.list();

      for (let columnData of columns){
        let { column, type = 'TEXT' } = columnData;
        
        if (!list.includes(column)){
          if (await this.columns.has(column))
            return console.log(`ending cause col exists ${column}`);
          
          database.prepare(`ALTER TABLE ${ table } ADD COLUMN ${ column } ${ type.toUpperCase() }`).run();
        }
      }
    },
    remove: async (...columns) => {
      const { table, database } = this;
			
      if (table  == undefined)
				console.error('@SqliteDriverTable.columns.remove: Missing Table');

      if (columns == undefined)
				console.error('@SqliteDriverTable.columns.remove: Missing Column');

      let list = await this.columns.list();

      for (const column of columns)
        if (list.includes(column))
          database.prepare(`ALTER TABLE ${table} DROP COLUMN ${column};`).run();
      }
    }
  }

  row = {
		has: async ({ where }) => {
      return await this.row.get({
				column: Object.keys(where)[0],
				where
			}) != null;
    },
    count: async () => await this.database.prepare(`SELECT Count(*) FROM ${this.table}`).get()['Count(*)'],
    getData: async ({ columns = [], where = {}, limit, order } = {}) => {
      const { database, table } = this;

      const columnList = await this.columns.list();

      const columnsFiltered = columns.filter(columnName => columnList.includes(columnName));

      const whereKeys = parseKeys({
				keys: where,
				pre: 'WHERE',
				joint: ' AND '
			});

			if (typeof limit !== 'number')
				limit = 1;

      return await database.prepare(`SELECT ${colString} FROM ${table} ${(whereKeys.string.length > 0 ? 'WHERE ' : '') + whereKeys.string};`).get(whereKeys.data);
    },
    getDataParsed: async (...args) =>  {
      const data = await this.row.getData(...args);

			if (typeof order == 'object')
				// 0 = Name
				// 1 = Order
				str.order = `ORDER BY ${Object.entries(order).map(columnSort => `${columnSort[0]} ${columnSort[1]}`).join(',')}`;

			const stmt = `SELECT ${str.cols} FROM ${table} ${str.where} ${str.order} ${str.limit};`;

      return newData;
    },
    getDataParsed: async (args) =>  {
      const data = await this.row.getData(args);

			if (data == undefined)
				return;

      const { database, table } = this;

      const whereKeys = parseKeys({
				keys: where,
				pre: 'WHERE',
				joint: ' AND '
			});

			const statement = `SELECT ${column} FROM ${table} ${parseWhereKeys(whereKeys.string)};`;
      const value = await database.prepare(statement).get(whereKeys.data);

      const columnType = (
				await this.columns.get(column)
			)?.type || 'TEXT';

      if (value?.[column] == undefined) return null;

      else if (this.handlers.hasOwnProperty(columnType)){
				const data = await this.handlers[columnType].parse(value?.[column]);

				return path != undefined ? get(data, path) : data;
			}
      else return value?.[column];
    },
		JSON: async ({ column, path, where = {} }) => {
			const columnData = await this.columns.get(column);
			if (columnData?.type != 'JSON') return console.error(`[!] SqliteDriverTable.row.updateJSON: Invalid Column Type For (${ column })`);
      
  		let obj = await this.row.get({ column, where });
			if (obj instanceof Object == false) obj = {};

			let send = async data => await this.row.setValues({
				columns: {
					[column]: data
				},
				where
			});

      let setOnPath = (obj = {}, path, value) => {
        if (path?.length > 0) set(obj, path, value);

        else obj = value;

        return obj;
      }

			let addSub = async function (second = 0){
				let first = get(obj, path);
				if (typeof first != 'number') first = 0;
				if (typeof second != 'number') second = 0;

				await send(
          setOnPath(obj, path, first + second)
        );

        return this;
			}

			return {
				get: async () => get(obj, path),
				update: async function (value) {
					await send(
            setOnPath(obj, path, value)
          );

          return this;
				},
				add: addSub,
				subtract: (args) => addSub(-args),
        /* Remember to finish push and pull features */
				push: async function (...items){
					let list = get(obj, path);
					if (!Array.isArray(list)) list = [];

					await send(
            setOnPath(obj, path, list)
          );
				},
				pull: async function (...remove) {
					let list = get(obj, path);
					if (!Array.isArray(list)) list = [];
					if (!Array.isArray(remove)) remove = [];
					
					list = list.filter(value => !remove.includes(value));

					await send(
            setOnPath(obj, path, list)
          );
				},
				delete: async function () {
          if (path == undefined) this.row.delete({ where });
          else {
            if (path?.includes('.'))
              unset(obj ?? {}, path);

            await send(obj);
          }

          return this;
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
      const { database, table, handlers, columns: cols } = this;
      const { where, columns } = args;

			const allColumns = await this.columns.getAll();
      const entryExists = await this.row.has({ where });

			for (const columnName of Object.keys(columns)){
				const columnData = allColumns.find(columnData => columnData.name == columnName);
				const { type } = columnData;

				if (
					columnData != undefined &&
					handlers?.[type]?.stringify
				){
					columns[columnName] = await handlers[type].stringify(columns[columnName]);
				}
				else delete columns[columnName];
			}
			
			if (Object.keys(columns).length == 0)
				return;

      if (entryExists){
        const columnKeys = parseKeys({
					keys: columns,
					pre: 'COL'
				});

				const whereKeys = parseKeys({
					keys: where, pre: 'WHERE',
					joint: ' AND '
				});

        let statement = `UPDATE ${table} SET ${columnKeys.string} WHERE ${whereKeys.string};`;
        
        await database.prepare(statement).run({
					...columnKeys.data,
					...whereKeys.data
				});
      }
      else {
				const valFix = Object.keys(columns).map($ => `@${$}`).toString();
        const statement = `INSERT INTO ${table} (${Object.keys(columns)}) values (${valFix})`;

        await database.prepare(statement).run(columns);
      }

      return this;
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

  async prepareTable ({ table, columns = { id: 'TEXT', data: 'JSON' }, pruneOtherColumns = false }){
    let columnTypes = (
      Object
      .entries(columns)
      .map(e => e.join(' '))
      .join(', ')
    );

    this.database.prepare(`CREATE TABLE IF NOT EXISTS ${ table } (${ columnTypes })`).run();
  }

  openTable ({ table }){
    if (table == undefined) throw '[!] OraDB.openTable: {table} cannot be undefined.'
    this.prepareTable({ table });
    
    return new OraDBTable({
      database: this.database,
      handlers: this.handlers,
      table
    });
  }

  async dropTable ({ table }){
    return this.database.prepare(`DROP TABLE IF EXISTS ${table};`).run();
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

export { OraDB }

export default OraDB;