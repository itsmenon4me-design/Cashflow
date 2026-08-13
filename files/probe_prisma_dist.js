(async ()=>{
  try{
    const { PrismaService } = require('../apps/backend/dist/database/prisma.service');
    const s = new PrismaService();
    console.log('Instantiated compiled PrismaService');
    try{
      await s.$connect();
      console.log('Prisma connected');
      await s.$disconnect();
    }catch(err){
      console.error('PRISMA_CONNECT_ERR_NAME:', err && err.name);
      console.error('PRISMA_CONNECT_ERR_MESSAGE:', err && err.message);
      console.error('PRISMA_CONNECT_ERR_STACK:', err && err.stack);
      process.exit(0);
    }
  }catch(e){
    console.error('PRISMA_INSTANTIATE_ERR:', e && e.stack ? e.stack : e);
    process.exit(0);
  }
})();
