import OraDB from '../index.js';

const db = new OraDB({
  path: `./db.sqlite`
});
const table = 'people'


let run = async () => {
  // await db.dropTable({ table: 'people' });
  await db.deleteAllRows({ table })

  const testTable = db.openTable({ table });
  let id = 'catgo';

  // await table.columns.add({
  //   column: 'data',
  //   type: 'json'
  // });
  


  let operation = await testTable.row.JSON({
    column: 'data', 
    where: { id }
  });

  console.log('starting')

  await operation.update(undefined, {
    id,
    data: {
      test: 'trdue'
    }
  }).then(obj => {
    
  })



  console.log('finished');

  // await testTable.row.setValues({
  //   columns: { id },
  //   where
  // });

  // console.log(
  //   await table.row.get({
  //     column: 'data',
  //     where: { id }
  //   })
  // )
}

run()