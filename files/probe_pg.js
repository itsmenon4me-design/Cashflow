const { Pool } = require('pg');

(async function(){
  try{
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    console.log('Pool created with connectionString:', process.env.DATABASE_URL);
    try{
      const client = await pool.connect();
      console.log('pool.connect() succeeded');
      client.release();
      await pool.end();
    }catch(err){
      console.error('PG_CONNECT_ERR_NAME:', err && err.name);
      console.error('PG_CONNECT_ERR_MESSAGE:', err && err.message);
      console.error('PG_CONNECT_ERR_STACK:', err && err.stack);
      process.exit(0);
    }
  }catch(e){
    console.error('PG_INSTANTIATE_ERROR:', e && e.stack ? e.stack : e);
    process.exit(0);
  }
})();
