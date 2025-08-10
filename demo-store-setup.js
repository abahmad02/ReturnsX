// Demo Store Setup Script for ReturnsX
// Run this to populate your demo store with realistic sample data

const sampleCustomerProfiles = [
  {
    phoneHash: "a1b2c3d4e5f6789", // Hash of +923001234567
    emailHash: "x9y8z7w6v5u4321", // Hash of high.risk@example.com
    riskScore: 85,
    riskTier: "high",
    totalOrders: 12,
    failedOrders: 9,
    successfulOrders: 3,
    totalValue: 45000, // PKR
    averageOrderValue: 3750,
    lastOrderDate: "2024-08-01",
    createdAt: "2024-01-15"
  },
  {
    phoneHash: "b2c3d4e5f6g7890",
    emailHash: "y8z7w6v5u4t3210", 
    riskScore: 45,
    riskTier: "medium",
    totalOrders: 18,
    failedOrders: 6,
    successfulOrders: 12,
    totalValue: 67500,
    averageOrderValue: 3750,
    lastOrderDate: "2024-08-05",
    createdAt: "2024-02-20"
  },
  {
    phoneHash: "c3d4e5f6g7h8901",
    emailHash: "z7w6v5u4t3s2109",
    riskScore: 15,
    riskTier: "zero", 
    totalOrders: 25,
    failedOrders: 2,
    successfulOrders: 23,
    totalValue: 125000,
    averageOrderValue: 5000,
    lastOrderDate: "2024-08-08",
    createdAt: "2024-03-10"
  },
  {
    phoneHash: "d4e5f6g7h8i9012",
    emailHash: "w6v5u4t3s2r1098",
    riskScore: 75,
    riskTier: "high",
    totalOrders: 8,
    failedOrders: 6,
    successfulOrders: 2,
    totalValue: 28000,
    averageOrderValue: 3500,
    lastOrderDate: "2024-07-28",
    createdAt: "2024-05-01"
  },
  {
    phoneHash: "e5f6g7h8i9j0123",
    emailHash: "v5u4t3s2r1q0987",
    riskScore: 5,
    riskTier: "zero",
    totalOrders: 30,
    failedOrders: 1,
    successfulOrders: 29,
    totalValue: 180000,
    averageOrderValue: 6000,
    lastOrderDate: "2024-08-09",
    createdAt: "2024-01-05"
  }
];

const sampleOrderEvents = [
  {
    orderId: "DEMO001",
    phoneHash: "a1b2c3d4e5f6789",
    eventType: "created",
    orderValue: 4500,
    timestamp: "2024-08-01T10:00:00Z"
  },
  {
    orderId: "DEMO001", 
    phoneHash: "a1b2c3d4e5f6789",
    eventType: "cancelled",
    orderValue: 4500,
    timestamp: "2024-08-01T15:30:00Z"
  },
  {
    orderId: "DEMO002",
    phoneHash: "b2c3d4e5f6g7890",
    eventType: "created", 
    orderValue: 3200,
    timestamp: "2024-08-05T14:20:00Z"
  },
  {
    orderId: "DEMO002",
    phoneHash: "b2c3d4e5f6g7890", 
    eventType: "fulfilled",
    orderValue: 3200,
    timestamp: "2024-08-07T11:45:00Z"
  },
  {
    orderId: "DEMO003",
    phoneHash: "c3d4e5f6g7h8901",
    eventType: "created",
    orderValue: 7500,
    timestamp: "2024-08-08T09:15:00Z"
  },
  {
    orderId: "DEMO003",
    phoneHash: "c3d4e5f6g7h8901",
    eventType: "fulfilled", 
    orderValue: 7500,
    timestamp: "2024-08-10T16:30:00Z"
  }
];

const demoStoreProducts = [
  {
    name: "Pakistani Lawn Suit - Summer Collection",
    price: 4500,
    description: "Premium lawn fabric with intricate embroidery",
    category: "Fashion",
    codPopular: true
  },
  {
    name: "Smartphone Case - iPhone 15 Pro",
    price: 1200, 
    description: "Protective case with wireless charging support",
    category: "Electronics",
    codPopular: true
  },
  {
    name: "Beauty Kit - Complete Makeup Set",
    price: 3500,
    description: "Professional makeup kit with 25 items",
    category: "Beauty",
    codPopular: true
  },
  {
    name: "Gaming Headset - Wireless Pro",
    price: 8500,
    description: "High-end gaming headset with noise cancellation", 
    category: "Electronics",
    codPopular: false
  },
  {
    name: "Traditional Jewelry Set",
    price: 12000,
    description: "Gold-plated jewelry set for special occasions",
    category: "Jewelry", 
    codPopular: true
  }
];

// Demo store configuration
const demoStoreConfig = {
  storeName: "ReturnsX Demo Store",
  storeUrl: "returnsx-demo.myshopify.com",
  description: "Demonstration store showcasing ReturnsX fraud prevention capabilities",
  
  riskSettings: {
    zeroRiskThreshold: 25,
    mediumRiskThreshold: 60,
    highRiskThreshold: 75,
    blockHighRisk: true,
    requireConfirmationMediumRisk: true,
    whatsappEnabled: true
  },
  
  analytics: {
    totalOrders: 150,
    preventedReturns: 45,
    savedAmount: 202500, // PKR
    successRateImprovement: 35 // percentage
  }
};

// Demo walkthrough script
const demoWalkthrough = [
  {
    step: 1,
    title: "Dashboard Overview",
    description: "Show main analytics dashboard with key metrics",
    keyPoints: [
      "Total orders processed: 150",
      "Returns prevented: 45 (30% reduction)", 
      "Money saved: PKR 202,500",
      "Network effect: Data from 50+ stores"
    ]
  },
  {
    step: 2,
    title: "Customer Risk Assessment", 
    description: "Demonstrate customer lookup and risk scoring",
    keyPoints: [
      "Search for +923001234567 (high-risk customer)",
      "Show 85% risk score and order history",
      "Display cross-store behavior data",
      "Explain privacy-safe hashing"
    ]
  },
  {
    step: 3,
    title: "Checkout Enforcement",
    description: "Demo storefront checkout blocking",
    keyPoints: [
      "Add product to cart", 
      "Enter high-risk phone number at checkout",
      "Show blocking message with alternative payment",
      "Test with medium-risk customer (confirmation required)"
    ]
  },
  {
    step: 4,
    title: "Historical Import",
    description: "Show how to import existing customer data",
    keyPoints: [
      "CSV upload interface",
      "Data mapping and validation",
      "Import progress tracking", 
      "Risk score calculation for imported data"
    ]
  },
  {
    step: 5,
    title: "Settings & Configuration",
    description: "Configure risk thresholds and enforcement rules",
    keyPoints: [
      "Adjust risk score thresholds",
      "Enable/disable enforcement modes",
      "WhatsApp integration setup",
      "Export settings for backup"
    ]
  }
];

console.log("Demo Store Setup Data Created");
console.log("==================================");
console.log(`Sample Customers: ${sampleCustomerProfiles.length}`);
console.log(`Order Events: ${sampleOrderEvents.length}`);
console.log(`Demo Products: ${demoStoreProducts.length}`);
console.log(`Walkthrough Steps: ${demoWalkthrough.length}`);

module.exports = {
  sampleCustomerProfiles,
  sampleOrderEvents, 
  demoStoreProducts,
  demoStoreConfig,
  demoWalkthrough
};
