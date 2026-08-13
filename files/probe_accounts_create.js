(async ()=>{
  try{
    const { PrismaService } = require('../apps/backend/dist/database/prisma.service');
    const { PrismaAccountsRepository } = require('../apps/backend/dist/modules/accounts/repositories/prisma-accounts.repository');

    const prisma = new PrismaService();
    console.log('PrismaService instantiated');
    try{
      await prisma.$connect();
      console.log('Prisma $connect succeeded');
    }catch(e){
      console.log('Prisma $connect failed (continuing to call repository) \n', e && e.stack ? e.stack : e);
    }

    const repo = new PrismaAccountsRepository(prisma);
    console.log('PrismaAccountsRepository created');

    try{
      const created = await repo.create({
        user_id: 'test-user',
        name: 'probe-account-' + Date.now(),
        account_type: 'CASH',
        currency: 'IDR',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
        is_active: true,
        is_default: false,
      });
      console.log('Create result:', created);
    }catch(err){
      console.error('CREATE_ERR_NAME:', err && err.name);
      console.error('CREATE_ERR_MESSAGE:', err && err.message);
      console.error('CREATE_ERR_CODE:', err && err.code);
      console.error('CREATE_ERR_STACK:', err && err.stack);
    }

    try{ await prisma.$disconnect(); }catch(_){}
  }catch(e){
    console.error('PROBE_FATAL:', e && e.stack ? e.stack : e);
  }
})();
