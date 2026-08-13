import { PrismaService } from "../apps/backend/src/database/prisma.service";

(async function main(){
  try{
    const s = new PrismaService();
    console.log('PrismaService instantiated');
    try{
      await s.$connect();
      console.log('Connected OK');
      await s.$disconnect();
    }catch(err:any){
      console.error('CONNECT_ERROR_NAME:', err && err.name);
      console.error('CONNECT_ERROR_MESSAGE:', err && err.message);
      console.error('CONNECT_ERROR_STACK:', err && err.stack);
      process.exit(0);
    }
  }catch(e:any){
    console.error('INSTANTIATE_ERROR:', e && e.stack ? e.stack : e);
    process.exit(0);
  }
})();
