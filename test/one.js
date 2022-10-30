import OraDB from '../index.js';

const db = new OraDB({
  path: `./db.sqlite`
});


let run = async () => {
  // await db.dropTable({ table: 'people' });
  const table = db.openTable({ table: 'people' });
  let id = 'catgo';

  // await table.columns.add({
  //   column: 'data',
  //   type: 'json'
  // });

  let operation = await table.row.JSON({
    column: 'data', 
    where: { id }
  });

  // console.log(operation)

  await operation.update({
    id: '50',
    data: {
      test: 'true'
    }
  })

  console.log(
    await table.row.get({
      column: 'data',
      where: { id: undefined }
    })
  )
}

run()

console.log(OraDB)