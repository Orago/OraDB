const OraDB = require('../index');
const myDb = new OraDB({ path: __dirname+`/leaderboard.sqlite` });
const casual = require('casual');



const table = myDb.openTable({ table: 'main' });

let run = async () => {
	await table.columns.remove('undefined');

	console.time('done')

	for (let i = 0; i < 5000; i++){
		await table.row.setValues({
			where: { name: 'null' },
			columns: {
				name: casual.username,
				score: casual.integer(from = 0, to = 1000)
			}
		});
	}


	console.timeEnd('done');
}

run();