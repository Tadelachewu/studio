"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Phone, Send, Signal, Battery, Lightbulb, Loader2 } from 'lucide-react';
import { mockBanks, MockDatabase, type MockLoan } from '@/lib/mock-data';
import { getAiHint } from '@/lib/actions';
import { AnimatePresence, motion } from 'framer-motion';

type Screen = 
  | "PIN" | "HOME" | "CHOOSE_BANK" | "CHOOSE_PRODUCT" | "APPLY_LOAN_AMOUNT" 
  | "APPLY_LOAN_CONFIRM" | "LOAN_STATUS" | "REPAY_SELECT_LOAN" | "REPAY_ENTER_AMOUNT"
  | "CHANGE_PIN" | "TRANSACTION_HISTORY";

type SessionData = {
  screen: Screen;
  pinAttempts: number;
  authenticated: boolean;
  selectedBankName?: string;
  selectedProductName?: string;
  loanAmount?: number;
  repayLoans?: MockLoan[];
  selectedRepayLoanId?: string;
  loanStatusPage: number;
};

const phoneNumber = "+251900000001"; // Simulating a logged-in user

export default function UssdSimulator() {
  const [session, setSession] = useState<SessionData>({
    screen: 'PIN',
    pinAttempts: 0,
    authenticated: false,
    loanStatusPage: 0,
  });
  const [displayMessage, setDisplayMessage] = useState("Enter your 4-digit PIN:");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [aiHint, setAiHint] =useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const getMenuText = useCallback((currentSession: SessionData): string => {
    switch (currentSession.screen) {
      case 'PIN':
        return `Enter your 4-digit PIN:`;
      case 'HOME':
        return `Welcome to Microloan USSD.\n1. Apply for Loan\n2. Check Loan Status\n3. Repay Loan\n4. Check Balance\n5. Transaction History\n6. Change PIN\n0. Exit`;
      case 'CHOOSE_BANK':
        return `Select Bank:\n${mockBanks.map((b, i) => `${i + 1}. ${b.Name}`).join("\n")}\n0. Home`;
      case 'CHOOSE_PRODUCT': {
        const bank = mockBanks.find(b => b.name === currentSession.selectedBankName);
        if (!bank) return "Error: Bank not found. \n0. Home";
        return `Choose a loan product:\n${bank.loanProducts.map((p, i) => `${i + 1}. ${p.Name} (Amount: ${p.MinAmount}-${p.MaxAmount})`).join("\n")}\n0. Home\n99. Back`;
      }
      case 'APPLY_LOAN_AMOUNT': {
        const bank = mockBanks.find(b => b.name === currentSession.selectedBankName);
        const product = bank?.loanProducts.find(p => p.name === currentSession.selectedProductName);
        if (!product) return "Error: Product not found. \n0. Home";
        return `Enter amount (range: ${product.minAmount}-${product.maxAmount})\n0. Home\n99. Back`;
      }
      case 'APPLY_LOAN_CONFIRM': {
        return `Confirm:\nProduct: ${currentSession.selectedProductName}\nAmount: ${currentSession.loanAmount}\n1. Confirm\n0. Home\n99. Back`;
      }
      case 'LOAN_STATUS': {
        const userLoans = MockDatabase.getLoans(phoneNumber);
        if (userLoans.length === 0) return "You have no loans.\n0. Home";
        const pageSize = 2;
        const page = currentSession.loanStatusPage;
        const loansToShow = userLoans.slice(page * pageSize, (page + 1) * pageSize);
        let response = "Your Loan Status:\n";
        response += loansToShow.map((loan, i) => {
            const outstanding = loan.amount + loan.interest - loan.repaid;
            return `${(page*pageSize) + i + 1}. ${loan.bankName}, ${loan.productName}, Outstanding: ${outstanding.toFixed(2)}`;
        }).join('\n');

        if ((page + 1) * pageSize < userLoans.length) response += "\n9. More";
        response += "\n0. Home";
        return response;
      }
      case 'REPAY_SELECT_LOAN': {
        const loans = currentSession.repayLoans || [];
        if(loans.length === 0) return "No active loans to repay.\n0. Home";
        let response = "Select loan to repay:\n";
        response += loans.map((loan, i) => {
            const outstanding = loan.amount + loan.interest - loan.repaid;
            return `${i + 1}. ${loan.bankName} - ${loan.productName} (Outstanding: ${outstanding.toFixed(2)})`;
        }).join('\n');
        response += "\n0. Home";
        return response;
      }
      case 'REPAY_ENTER_AMOUNT': {
        const loan = (currentSession.repayLoans || []).find(l => l.id === currentSession.selectedRepayLoanId);
        if(!loan) return "Error: Loan not found.\n0. Home";
        const outstanding = loan.amount + loan.interest - loan.repaid;
        return `Enter amount to repay (Outstanding: ${outstanding.toFixed(2)})\n0. Home\n99. Back`;
      }
      case 'CHANGE_PIN':
        return `Enter new 4-digit PIN:\n0. Home`;
      case 'TRANSACTION_HISTORY': {
        const transactions = MockDatabase.getTransactions(phoneNumber).slice(-5);
        if (transactions.length === 0) return "No transactions found.\n0. Home";
        return `Transaction History:\n${transactions.join('\n')}\n0. Home`;
      }
      default: return `Invalid Screen.\n0. Exit`;
    }
  }, []);


  const processUssdRequest = useCallback((input: string) => {
    setIsLoading(true);
    let nextSession = { ...session };
    let response = "";
    let endSession = false;

    const goHome = () => {
      nextSession.screen = 'HOME';
    };

    const goBack = () => {
        const prevScreen = history.pop() as Screen | undefined;
        if(prevScreen) {
          nextSession.screen = prevScreen;
          setHistory([...history]);
        } else {
          goHome();
        }
    };
    
    if (input !== 'BACK') setHistory([...history, session.screen]);

    switch (session.screen) {
      case 'PIN':
        const pin = MockDatabase.getPin(phoneNumber) || "1234";
        if (input.length === 4 && /^\d+$/.test(input)) {
          if (input === pin) {
            nextSession.authenticated = true;
            nextSession.screen = 'HOME';
            nextSession.pinAttempts = 0;
          } else {
            nextSession.pinAttempts++;
            if (nextSession.pinAttempts >= 3) {
              response = `Too many incorrect PIN attempts. Session ended.`;
              endSession = true;
            } else {
              response = `Incorrect PIN. Attempt ${nextSession.pinAttempts} of 3. Try again:`;
            }
          }
        } else {
            response = "Invalid PIN format. Enter your 4-digit PIN:";
        }
        break;

      case 'HOME':
        switch (input) {
          case '1': nextSession.screen = 'CHOOSE_BANK'; break;
          case '2': nextSession.screen = 'LOAN_STATUS'; nextSession.loanStatusPage = 0; break;
          case '3': 
            nextSession.screen = 'REPAY_SELECT_LOAN';
            nextSession.repayLoans = MockDatabase.getLoans(phoneNumber).filter(l => l.status === 'Active' && (l.amount + l.interest - l.repaid) > 0);
            break;
          case '4': 
            const balance = MockDatabase.getBalance(phoneNumber);
            response = `Your account balance is: ${balance.toFixed(2)}`; 
            endSession = true;
            break;
          case '5': nextSession.screen = 'TRANSACTION_HISTORY'; break;
          case '6': nextSession.screen = 'CHANGE_PIN'; break;
          case '0': response = "Thank you for using Microloan USSD."; endSession = true; break;
          default: response = "Invalid choice."; break;
        }
        break;

      case 'CHOOSE_BANK':
        if(input === '0') { goHome(); break; }
        const bankChoice = parseInt(input) - 1;
        if (bankChoice >= 0 && bankChoice < mockBanks.length) {
          nextSession.screen = 'CHOOSE_PRODUCT';
          nextSession.selectedBankName = mockBanks[bankChoice].name;
        } else {
          response = "Invalid bank choice.";
        }
        break;
      
      case 'CHOOSE_PRODUCT':
        if (input === '0') { goHome(); break; }
        if (input === '99') { nextSession.screen = 'CHOOSE_BANK'; break; }

        const bank = mockBanks.find(b => b.name === session.selectedBankName);
        if (bank) {
          const productChoice = parseInt(input) - 1;
          if (productChoice >= 0 && productChoice < bank.loanProducts.length) {
            nextSession.screen = 'APPLY_LOAN_AMOUNT';
            nextSession.selectedProductName = bank.loanProducts[productChoice].name;
          } else {
            response = "Invalid product choice.";
          }
        }
        break;
    
      case 'APPLY_LOAN_AMOUNT':
        if (input === '0') { goHome(); break; }
        if (input === '99') { nextSession.screen = 'CHOOSE_PRODUCT'; break; }
        
        const currentBank = mockBanks.find(b => b.name === session.selectedBankName);
        const currentProduct = currentBank?.loanProducts.find(p => p.name === session.selectedProductName);
        const amount = parseFloat(input);
        if (currentProduct && !isNaN(amount) && amount >= currentProduct.minAmount && amount <= currentProduct.maxAmount) {
          nextSession.screen = 'APPLY_LOAN_CONFIRM';
          nextSession.loanAmount = amount;
        } else {
          response = `Invalid amount. Enter a number between ${currentProduct?.minAmount} and ${currentProduct?.maxAmount}.`;
        }
        break;

      case 'APPLY_LOAN_CONFIRM':
        if (input === '0') { goHome(); break; }
        if (input === '99') { nextSession.screen = 'APPLY_LOAN_AMOUNT'; break; }
        
        if(input === '1') {
          const { selectedBankName, selectedProductName, loanAmount } = session;
          const product = mockBanks.find(b => b.name === selectedBankName)?.loanProducts.find(p => p.name === selectedProductName);
          if(selectedBankName && selectedProductName && loanAmount && product) {
            MockDatabase.addLoan(phoneNumber, selectedBankName, selectedProductName, loanAmount, loanAmount * product.interestRate);
            response = `Application for ${loanAmount.toFixed(2)} for ${selectedProductName} submitted! Amount credited.`;
            endSession = true;
          } else {
            response = "An error occurred. Please try again.";
            goHome();
          }
        } else {
          response = "Invalid choice.";
        }
        break;

      case 'LOAN_STATUS':
        if(input === '0') { goHome(); break; }
        if(input === '9') {
          nextSession.loanStatusPage = session.loanStatusPage + 1;
        }
        break;

      case 'REPAY_SELECT_LOAN':
        if (input === '0') { goHome(); break; }
        const repayChoice = parseInt(input) - 1;
        if (session.repayLoans && repayChoice >= 0 && repayChoice < session.repayLoans.length) {
          nextSession.screen = 'REPAY_ENTER_AMOUNT';
          nextSession.selectedRepayLoanId = session.repayLoans[repayChoice].id;
        } else {
          response = "Invalid loan selection.";
        }
        break;

      case 'REPAY_ENTER_AMOUNT':
        if (input === '0') { goHome(); break; }
        if (input === '99') { nextSession.screen = 'REPAY_SELECT_LOAN'; break; }
        
        const repayLoan = session.repayLoans?.find(l => l.id === session.selectedRepayLoanId);
        const repayAmount = parseFloat(input);
        if (repayLoan) {
            const outstanding = repayLoan.amount + repayLoan.interest - repayLoan.repaid;
            if (!isNaN(repayAmount) && repayAmount > 0 && repayAmount <= outstanding) {
                MockDatabase.repayLoan(phoneNumber, repayLoan.id, repayAmount);
                response = `Repayment of ${repayAmount.toFixed(2)} successful.`;
                endSession = true;
            } else {
                response = `Invalid amount. Enter a number between 1 and ${outstanding.toFixed(2)}.`;
            }
        }
        break;

      case 'CHANGE_PIN':
        if (input === '0') { goHome(); break; }
        if (input.length === 4 && /^\d+$/.test(input)) {
            MockDatabase.setPin(phoneNumber, input);
            response = "PIN changed successfully.";
            endSession = true;
        } else {
            response = "Invalid PIN format. Enter new 4-digit PIN.";
        }
        break;

      case 'TRANSACTION_HISTORY':
        if (input === '0') { goHome(); break; }
        break;
    }
    
    setTimeout(() => {
        setSession(nextSession);
        const finalMessage = response || getMenuText(nextSession);
        setDisplayMessage(finalMessage);
        
        if (endSession) {
            setTimeout(() => {
                const freshSession = { screen: 'PIN' as Screen, pinAttempts: 0, authenticated: false, loanStatusPage: 0 };
                setSession(freshSession);
                setDisplayMessage(getMenuText(freshSession));
                setHistory([]);
            }, 3000);
        }
        setIsLoading(false);
        setInputValue("");
    }, 500);

  }, [session, getMenuText, history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    const fetchHint = async () => {
      if (session.authenticated && !isLoading) {
        setIsHintLoading(true);
        setAiHint(null);
        try {
          const hint = await getAiHint({
            userInput: history[history.length-1] || 'none',
            currentScreen: displayMessage,
          });
          setAiHint(hint);
        } catch (error) {
          setAiHint("Could not load hint.");
        } finally {
          setIsHintLoading(false);
        }
      } else {
        setAiHint(null);
      }
    };

    fetchHint();
  }, [displayMessage, session.authenticated, isLoading, history]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      processUssdRequest(inputValue.trim());
    }
  };

  return (
    <Card className="w-full max-w-sm mx-auto shadow-2xl overflow-hidden bg-gray-900 border-gray-700 rounded-3xl font-mono">
      <CardHeader className="bg-black p-2">
        <div className="flex justify-between items-center text-white text-xs px-2">
          <span>10:24</span>
          <div className="flex items-center gap-1">
            <Signal size={14} />
            <Battery size={14} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 bg-gray-800/50 text-white min-h-[300px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
            <motion.div
                key={displayMessage}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="whitespace-pre-wrap text-center text-lg leading-relaxed"
            >
                {isLoading ? <Loader2 className="animate-spin h-8 w-8 mx-auto" /> : displayMessage}
            </motion.div>
        </AnimatePresence>
      </CardContent>
      <CardFooter className="p-4 flex flex-col gap-4 bg-gray-900">
        <AnimatePresence>
            {aiHint && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full"
                >
                    <div className="flex items-start gap-2 text-sm text-cyan-300 bg-cyan-900/50 p-2 rounded-lg border border-cyan-700">
                        <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="flex-grow">{isHintLoading ? "Thinking..." : aiHint}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
        <form onSubmit={handleSubmit} className="flex w-full space-x-2">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter selection..."
            className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-accent focus:ring-2 flex-grow rounded-lg"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90 rounded-lg" disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="flex justify-around w-full">
            <Button variant="ghost" className="text-gray-400 hover:text-white" disabled={isLoading}><Phone className="h-5 w-5" /></Button>
        </div>
      </CardFooter>
    </Card>
  );
}
