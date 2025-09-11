import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Test page to simulate a Shopify thank you page
 * Use this to test the ReturnsX script functionality
 */

export async function loader({ request }: LoaderFunctionArgs) {
  const appUrl = new URL(request.url).origin;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank you - Order Confirmation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .confirmation {
            background: #e8f5e8;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        .order-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Thank you, AODjaois!</h1>
            <p>Confirmation #Y89ARWR2</p>
        </div>
        
        <div class="confirmation">
            <h2>Your order is confirmed</h2>
            <p>You'll receive a confirmation email with your order number shortly.</p>
        </div>
        
        <div class="order-details">
            <div>
                <h3>Contact Information</h3>
                <p>abdullah123ahmad@gmail.com</p>
                
                <h3>Shipping Address</h3>
                <p>AODjaois sijhdoasd<br>
                sodjaosdjo<br>
                wjelfds<br>
                sjsd SDIOF<br>
                Pakistan</p>
            </div>
            
            <div>
                <h3>Payment Method</h3>
                <p>Cash on Delivery (COD) - Rs 730.74 PKR</p>
                
                <h3>Order Summary</h3>
                <p>The Multi-managed Snowboard - Rs 629.95</p>
                <p>Shipping: FREE</p>
                <p>Taxes: Rs 100.79</p>
                <p><strong>Total: Rs 730.74 PKR</strong></p>
            </div>
        </div>
    </div>

    <!-- Load the ReturnsX script -->
    <script src="${appUrl}/thank-you-script.js"></script>
    
    <script>
        // Add some debugging
        console.log('Test page loaded');
        console.log('Script should load from:', '${appUrl}/thank-you-script.js');
        
        // Check if script loaded after a delay
        setTimeout(() => {
            console.log('Checking if ReturnsX widget was added...');
            const widget = document.getElementById('returnsx-risk-widget');
            const testWidget = document.getElementById('returnsx-test-widget');
            console.log('Risk widget found:', !!widget);
            console.log('Test widget found:', !!testWidget);
        }, 5000);
    </script>
</body>
</html>
`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}