import UssdSimulator from '@/components/ussd-simulator';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-headline font-bold text-center mb-2 text-primary">
          Mobili Finance
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          A USSD-based microloan service simulation.
        </p>
        <UssdSimulator />
      </div>
    </main>
  );
}
