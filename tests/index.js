const OraDB = require('../index');
const myDb = new OraDB({ path: __dirname+`/transactions.sqlite` });

const table = myDb.openTable({ table: 'main' });

let run = async () => {
	await table.columns.remove('undefined')

	const al = await table.row.getDataParsed({ limit: 2, where: { uid: 'oracwego' } })
	console.log(
		al, al.length
	)
}

run();