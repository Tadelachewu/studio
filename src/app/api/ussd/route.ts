import { processUssdRequest } from '@/services/ussd-handler';

export async function POST(req: Request) {
  const body = await req.formData();
  console.log('--- Incoming USSD POST Request ---');
  console.log('Request Body:', Object.fromEntries(body.entries()));

  const sessionId = body.get('sessionId') as string;
  const phoneNumber = body.get('phoneNumber') as string;
  const text = body.get('text') as string;

  // Added to handle forwarded requests from the parent USSD app
  const forwardedPin = body.get('pin') as string | null;
  const forwardedLanguage = body.get('language') as 'en' | 'am' | null;

  const responseBody = await processUssdRequest(
    sessionId,
    phoneNumber,
    text,
    forwardedPin,
    forwardedLanguage
  );

  console.log(`Sending Response: "${responseBody}"`);
  console.log('------------------------------------');

  return new Response(responseBody, {
    headers: { 'Content-Type': 'text/plain' },
  });
}

    