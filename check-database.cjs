const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database:', process.env.DATABASE_URL?.split('@')[1]?.split('?')[0] || 'Unknown');
    console.log('');
    
    const customerCount = await prisma.customerProfile.count();
    console.log('CustomerProfile count:', customerCount);
    
    const correlationCount = await prisma.checkoutCorrelation.count();
    console.log('CheckoutCorrelation count:', correlationCount);
    
    const orderEventCount = await prisma.orderEvent.count();
    console.log('OrderEvent count:', orderEventCount);
    
    // Get sample data
    const sampleCustomers = await prisma.customerProfile.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        phone: true,
        email: true,
        totalOrders: true,
        riskTier: true,
        createdAt: true
      }
    });
    
    console.log('\nSample customers (most recent):');
    console.log(JSON.stringify(sampleCustomers, null, 2));
    
    const sampleCorrelations = await prisma.checkoutCorrelation.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        checkoutToken: true,
        orderId: true,
        orderName: true,
        customerPhone: true,
        createdAt: true
      }
    });
    
    console.log('\nSample checkout correlations (most recent):');
    console.log(JSON.stringify(sampleCorrelations, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
