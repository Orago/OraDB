# OraDB - API
For your information, this project is very recently released and most of the links in the documentation are non functional.

# Template Database
| id | usernmame | age |
|----|-----------|-----|
| 1  | orago     | 17  |
| 2  | KING      | 10  |
| 3  | grimm     | 20  |



# class *Database*
- [new Database()](#new-database-options)
- [Database.openTable](#open-table-options)
- [Database.dropTable](#drop-table-options)
- [Database.deleteAllRows](#delete-all-rows-options)

## new Datebase({ options })
Creates a new database instance that has access to modifying and accessing tables.

- `options.path`: Open or create the database in specific path and name (default: `main.db`).

```js
const OraDB = require('./database.js');

let myDb = new OraDB({
  path: '/users.db'
});
```

### .openTable({ options })
Opens the table to allow access for column and row manipulation.
Also referenced as [Table](#database)

- `options.table`: The name of your table.

```js
myDb.openTable({
	table: 'users'
});
```

### .dropTable({ options })
Completely removes the table from your database.

- `options.table`: The name of your table.

```js
await myDb.dropTable({
	table: 'users'
});
```

### .deleteAllRows({ options })
Removes all rows in a table.

- `options.table`: The name of your table.

```js
await myDb.deleteAllRows({
	table: 'users'
});
```

# Subclass *Table*
This is created from [Database#openTable](#open-table-options)

```js
const userTable = myDb.openTable({
	table: 'users'
});
```
## .columns
### .getAll()
Returns all data for each column.

```js
let recievedColumns = await userTable.columns.getAll();
console.log(recievedColumns); /* =>
[
  {
    cid: 0,
    name: 'id',
    type: 'INTEGER',
    notnull: 0,
    dflt_value: null,
    pk: 0
  },
  {
    cid: 1,
    name: 'username',
    type: 'TEXT',
    notnull: 0,
    dflt_value: null,
    pk: 0
  },
  {
    cid: 2,
    name: 'age',
    type: 'INTEGER',
    notnull: 0,
    dflt_value: null,
    pk: 0
  }
]
/*
```

### .list()
Returns a list of each column name for the current table.

```js
let recievedColumns = userTable.columns.getAll
console.log(recievedColumns); // => ['id', 'username', 'age']
```

### .get( column )
Returns data for a singular column.
- `column`: Column Name

```js
let recievedColumn = await userTable.columns.get('username');
console.log(recievedColumn); /* =>
{
    cid: 1,
    name: 'username',
    type: 'TEXT',
    notnull: 0,
    dflt_value: null,
    pk: 0
}
/*
```

### .has( column )
Returns true or false based on whether the column exists in the database.

- `column`: Column Name

```js
console.log(
	await userTable.columns.has('tornados')
); // => false

console.log(
	await userTable.columns.has('age')
); // => true
```

### .rename( options )
Changes the name of a column.

-`options.column`: The original name of the column.
-`options.to`: The new name for the column.

```js
await userTable.columns.rename({
  column: 'age',
  to: 'favorite-number'
});
```

Resulting Database:

|id|username|favorite-number|
|1|orago|17|
|2|king|10|
|3|grimm|20|

### .add( column )
Creates a new column but all data under it will be NULL until set.

-`column`: Data Object, can be multiple (`columnData`).

-`columnData.column`: Name of the new column.
-`columnData.type`: Data type of column (default: `TEXT`).

```js
await userTable.columns.add({
	column: 'role',
	type: 'TEXT'
},
{
	column: 'data',
	type: 'JSON'
});
```

Resulting Database:

|id|username|age|role|data|
|1|orago|17|NULL|NULL|
|2|king|10|NULL|NULL|
|3|grimm|20|NULL|NULL|

| id | usernmame | age | role | data |
|----|-----------|-----|------|------|
| 1  | orago     | 17  | NULL | NULL |
| 2  | KING      | 10  | NULL | NULL |
| 3  | grimm     | 20  | NULL | NULL |

### .remove( column )
Removes a column and all of the data inside of it.

-`column`: Name of the column to remove, can be multiple.

```js
await userTable.columns.remove('id', 'username');
```

Resulting Database:
| age |
|-----|
| 17  |
| 10  |
| 20  |

## .rows
### .has({ options })
Returns true or false whether an entry exists matching a column name and column value

-`options.where`: An object where each key is a column requirement, and the value is the term to be matched in the database.

(Sorry if this one is confusing)

Database searching from:
|id|username|age|
|1|orago|17|
|2|king|10|
|3|grimm|20|


```js
console.log(
	await userTable.row.has({
		where: { id: 0 }
	})
) // => true

console.log(
	await userTable.row.has({
		where: { id: 5 }
	})
) // => false

console.log(
	await userTable.row.has({
		where: {
			username: 'orago'
		}
	})
) // => true
```

### .count()
Returns the number of rows in a table

Database searching from:
| id | usernmame | age |
|----|-----------|-----|
| 1  | orago     | 17  |
| 2  | KING      | 10  |
| 3  | grimm     | 20  |

```js
console.log(
	await userTable.row.count()
) // => 3
```

### .getData({ options })
Returns non handled data from an array

-`options.columns`: The columns to return (Default: `*`).
-`options.where`: The statement to match for an entry.

Database searching from:
| id | usernmame | age |
|----|-----------|-----|
| 1  | orago     | 17  |
| 2  | KING      | 10  |
| 3  | grimm     | 20  |

```js
console.log(
	await userTable.row.getData({
		columns: ['username', 'age'],
		where: { username: 'grimm' }
	})
); /* =>
{
	username: 'grimm',
	age: 21
}
*/
```

Reminder to self:
Things left to document - .row.getDataParsed, .row.get, .row.JSON, .row.delete, .row.setValues, (How to use custom data types and handlers)