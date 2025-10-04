import { PrismaClient } from "@prisma/client";
import { getDatabaseConfig, generateOptimizedDatabaseUrl } from "./config/database.server";

declare global {
  var prismaGlobal: PrismaClient;
}

// Get optimized database configuration
const dbConfig = getDatabaseConfig();

// Optimized connection pool configuration
const createPrismaClient = () => {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Generate optimized database URL with connection pool parameters
  const optimizedUrl = generateOptimizedDatabaseUrl(baseUrl, dbConfig);

  return new PrismaClient({
    datasources: {
      db: {
        url: optimizedUrl,
      },
    },
    log: dbConfig.enableQueryLogging 
      ? ["query", "error", "warn", "info"] 
      : ["error"],
    errorFormat: "pretty",
  });
};

// Connection pool configuration via DATABASE_URL parameters
// Example: postgresql://user:pass@host:port/db?connection_limit=20&pool_timeout=20&schema=public

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
}

const prisma = global.prismaGlobal ?? createPrismaClient();

// Connection pool monitoring
let connectionCount = 0;
let queryCount = 0;

// Middleware to track connection usage
prisma.$use(async (params, next) => {
  const start = Date.now();
  queryCount++;
  
  try {
    const result = await next(params);
    const duration = Date.now() - start;
    
    // Log slow queries in development
    if (process.env.NODE_ENV === "development" && duration > 1000) {
      console.warn(`Slow query detected: ${params.model}.${params.action} took ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    console.error(`Database error in ${params.model}.${params.action}:`, error);
    throw error;
  }
});

// Health check function
export const checkDatabaseHealth = async (): Promise<{
  connected: boolean;
  responseTime: number;
  error?: string;
}> => {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      connected: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Get connection statistics
export const getConnectionStats = () => ({
  queryCount,
  uptime: process.uptime(),
  memoryUsage: process.memoryUsage(),
  nodeVersion: process.version
});

// Graceful shutdown
export const closeDatabaseConnection = async () => {
  await prisma.$disconnect();
};

// Handle process termination
process.on('SIGINT', closeDatabaseConnection);
process.on('SIGTERM', closeDatabaseConnection);

export default prisma;
