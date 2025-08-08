import { processUssdRequest } from '@/services/ussd-handler';

export async function POST(req: Request) {
  const body = await req.formData();
  console.log('--- Incoming USSD POST Request ---');
  console.log('Request Body:', Object.fromEntries(body.entries()));

  const sessionId = body.get('sessionId') as string;
  const phoneNumber = body.get('phoneNumber') as string;
  const text = body.get('text') as string;

  // Check for data forwarded from a parent USSD app
  const forwardedPin = body.get('pin');
  const forwardedLanguage = body.get('language');

  const responseBody = await processUssdRequest(
    sessionId,
    phoneNumber,
    text,
    forwardedPin as string | null,
    forwardedLanguage as string | null
  );

  console.log(`Sending Response: "${responseBody}"`);
  console.log('------------------------------------');

  return new Response(responseBody, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
