const OraDB = require('../index');
const myDb = new OraDB({ path: __dirname+`/leaderboard.sqlite` });

const table = myDb.openTable({ table: 'main' });

let run = async () => {
	await table.columns.remove('undefined')


	const al = await table.row.getDataParsed({ order: 'random' })
	console.log(
		al, al?.length
	)
}

run();