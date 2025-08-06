export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-headline font-bold text-primary">
          NIB Loan USSD API
        </h1>
        <p className="mt-2 text-muted-foreground">
          The USSD API endpoint is running at /api/ussd.
        </p>
      </div>
    </main>
  );
}
