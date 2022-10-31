import OraDB from '../index.js';

const db = new OraDB({
  path: `./db.sqlite`
});
const table = 'people'


let run = async () => {
  // await db.dropTable({ table: 'people' });
  await db.deleteAllRows({ table })

  const testTable = db.openTable({ table });
  let id = 'orago';

  // await table.columns.add({
  //   column: 'data',
  //   type: 'json'
  // });
  
  await testTable.row.setValues({
    columns: {
      id,
      data: {
        age: 17
      }
    },
    where: {
      id
    }
  }).then(async db => {
    let { row } = db;

    await row.JSON({
      column: 'data',
      path: 'tdsta',
      where: { id }
    })
    .then(e => 
      e.update({
        id,
        data: {
          test: 'trdue'
        }
      })
    );

    await row.JSON({
      column: 'data',
      path: 'age',
      where: { id }
    })
    .then(e => 
      e.subtract(50000)
    );
  });
}

run()