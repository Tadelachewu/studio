import { processUssdRequest } from '@/services/ussd-handler';

export async function POST(req: Request) {
  const body = await req.formData();
  const sessionId = body.get('sessionId') as string;
  const phoneNumber = body.get('phoneNumber') as string;
  const text = body.get('text') as string;

  // From Africa's Talking, the text is a string of inputs separated by *.
  // We need the last input in the sequence.
  const userInput = text.split('*').pop()?.trim() || '';

  const responseBody = processUssdRequest(sessionId, phoneNumber, userInput);

  return new Response(responseBody, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
