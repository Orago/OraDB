const OraDB = require('../index');
const myDb = new OraDB({ path: __dirname+`/transactions.sqlite` });

const table = myDb.openTable({ table: 'main' });

let run = async () => {
	await table.columns.remove('undefined')


	const al = await table.row.getDataParsed({
		where: { id: '69ae752e-9f1f-457f-af71-56f7e82925dc' },
		order: { id: 'ASC' }
	})

	console.table(al.data)

	// myDb.testTable()
}

run();