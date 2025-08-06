import { getMenuText } from '@/lib/menu';
import { mockBanks, MockDatabase } from '@/lib/mock-data';
import { sessionManager } from '@/lib/session';
import { normalizePhoneNumber } from '@/lib/utils';
import { SessionData } from '@/lib/types';

export function processUssdRequest(
  sessionId: string,
  phoneNumber: string,
  userInput: string
): string {
  console.log('[Handler] Processing request:', { sessionId, phoneNumber, userInput });
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  let session = sessionManager.getSession(sessionId);
  let responsePrefix = 'CON';
  let responseMessage = '';

  if (!session) {
    console.log('[Handler] No session found, creating a new one.');
    session = sessionManager.createSession(sessionId, normalizedPhone);
  }

  const user = MockDatabase.getUserByPhoneNumber(normalizedPhone);
  if (!user) {
    console.log(`[Handler] User not found for phone: ${normalizedPhone}. Ending session.`);
    responsePrefix = 'END';
    responseMessage = 'Your phone number is not registered.';
    sessionManager.deleteSession(sessionId);
    return `${responsePrefix} ${responseMessage}`;
  }
  console.log('[Handler] User found:', { phoneNumber: user.phoneNumber, isVerified: user.isVerified });

  if (!user.isVerified) {
    console.log('[Handler] User is not verified. Ending session.');
    responsePrefix = 'END';
    responseMessage =
      'Your account is not verified. Please contact customer support.';
    sessionManager.deleteSession(sessionId);
    return `${responsePrefix} ${responseMessage}`;
  }

  if (!session.authenticated) {
    console.log('[Handler] User not authenticated. Checking PIN.');
    if (userInput !== '') {
      const correctPin = MockDatabase.getPin(normalizedPhone);
      if (correctPin && userInput === correctPin) {
        console.log('[Handler] PIN correct. Authenticating session.');
        session.authenticated = true;
        session.screen = 'HOME';
        session.pinAttempts = 0;
        responseMessage = 'Login successful.\n';
      } else {
        session.pinAttempts++;
        console.log(`[Handler] Incorrect PIN. Attempt ${session.pinAttempts}.`);
        if (session.pinAttempts >= 3) {
          console.log('[Handler] Too many PIN attempts. Ending session.');
          responseMessage = 'Too many incorrect PIN attempts. Session ended.';
          responsePrefix = 'END';
          sessionManager.deleteSession(sessionId);
        } else {
          responseMessage = `Incorrect PIN. Attempt ${session.pinAttempts} of 3. Try again:`;
        }
      }
    }
    if (!session.authenticated && responsePrefix !== 'END') {
       console.log('[Handler] Staying on PIN screen.');
       sessionManager.updateSession(sessionId, session);
       const menuText = getMenuText(session);
       return `${responsePrefix} ${responseMessage || menuText}`;
    }
  }

  let nextSession: SessionData = { ...session };
  console.log(`[Handler] Processing screen: "${session.screen}" with input: "${userInput}"`);


  const goHome = () => {
    console.log('[Handler] Navigating to HOME screen.');
    nextSession.screen = 'HOME';
  };
  
  if (session.screen !== 'HOME' && session.screen !== 'PIN') {
    if (userInput === '0') {
      goHome();
    } else if (userInput === '99') {
      console.log(`[Handler] Going back from ${session.screen}`);
      switch (session.screen) {
        case 'CHOOSE_PRODUCT':
          nextSession.screen = 'CHOOSE_BANK';
          break;
        case 'APPLY_LOAN_AMOUNT':
          nextSession.screen = 'CHOOSE_PRODUCT';
          break;
        case 'APPLY_LOAN_CONFIRM':
          nextSession.screen = 'APPLY_LOAN_AMOUNT';
          break;
        case 'REPAY_ENTER_AMOUNT':
          nextSession.screen = 'REPAY_SELECT_LOAN';
          break;
        case 'CHOOSE_BANK':
        case 'LOAN_STATUS':
        case 'REPAY_SELECT_LOAN':
        case 'LOAN_HISTORY':
          goHome();
          break;
      }
    }
  }

  if (nextSession.screen === session.screen) {
    switch (session.screen) {
      case 'PIN':
        if (session.authenticated) {
          console.log('[Handler] PIN screen logic after successful auth. Moving to HOME.');
          nextSession.screen = 'HOME';
        }
        break;

      case 'HOME':
        switch (userInput) {
          case '1':
            nextSession.screen = 'CHOOSE_BANK';
            break;
          case '2':
            nextSession.screen = 'LOAN_STATUS';
            nextSession.loanStatusPage = 0;
            break;
          case '3':
            nextSession.screen = 'REPAY_SELECT_LOAN';
            nextSession.repayLoans = MockDatabase.getLoans(
              normalizedPhone
            ).filter(
              (l) => l.status === 'Active' && l.amount + l.interest - l.repaid > 0
            );
            break;
          case '4':
            const balance = MockDatabase.getBalance(normalizedPhone);
            responseMessage = `Your account balance is: ${balance.toFixed(2)}`;
            responsePrefix = 'END';
            sessionManager.deleteSession(sessionId);
            break;
          case '5':
            nextSession.screen = 'LOAN_HISTORY';
            break;
          case '0':
            responseMessage = 'Thank you for using NIB Loan.';
            responsePrefix = 'END';
            sessionManager.deleteSession(sessionId);
            break;
          default:
            if (responseMessage.includes('Login successful')) {
               break;
            }
            responseMessage = 'Invalid choice.';
            break;
        }
        console.log(`[Handler] HOME selection: "${userInput}", next screen: "${nextSession.screen}"`);
        break;

      case 'CHOOSE_BANK':
        const bankChoice = parseInt(userInput) - 1;
        if (bankChoice >= 0 && bankChoice < mockBanks.length) {
          const selectedBankName = mockBanks[bankChoice].name;
          const existingLoans = MockDatabase.getLoans(normalizedPhone);
          const hasActiveLoanFromSameBank = existingLoans.some(
            (loan) => loan.bankName === selectedBankName && loan.status === 'Active'
          );

          if (hasActiveLoanFromSameBank) {
              console.log(`[Handler] User already has an active loan with ${selectedBankName}.`);
              responseMessage = `You already have an active loan with this provider. Please repay your current loan before applying again.`;
              responsePrefix = 'END';
              sessionManager.deleteSession(sessionId);
          } else {
            nextSession.screen = 'CHOOSE_PRODUCT';
            nextSession.selectedBankName = selectedBankName;
            nextSession.productPage = 0;
            console.log(`[Handler] Bank chosen: "${nextSession.selectedBankName}"`);
          }
        } else {
          console.log('[Handler] Invalid bank choice.');
          responseMessage = 'Invalid bank choice.';
        }
        break;

      case 'CHOOSE_PRODUCT':
        const bank = mockBanks.find((b) => b.name === session.selectedBankName);
        if (bank) {
          if (userInput === '8') {
             const currentPage = nextSession.productPage || 0;
             if ((currentPage + 1) * 2 < bank.loanProducts.length) {
                nextSession.productPage = currentPage + 1;
             }
             break;
          }
          if (userInput === '7') {
             const currentPage = nextSession.productPage || 0;
             if (currentPage > 0) {
                nextSession.productPage = currentPage - 1;
             }
             break;
          }

          const productChoice = parseInt(userInput) - 1;
          if (
            productChoice >= 0 &&
            productChoice < bank.loanProducts.length
          ) {
            nextSession.screen = 'APPLY_LOAN_AMOUNT';
            nextSession.selectedProductName =
              bank.loanProducts[productChoice].name;
            console.log(`[Handler] Product chosen: "${nextSession.selectedProductName}"`);
          } else {
            console.log('[Handler] Invalid product choice.');
            responseMessage = 'Invalid product choice.';
          }
        }
        break;

      case 'APPLY_LOAN_AMOUNT':
        const currentBank = mockBanks.find(
          (b) => b.name === session.selectedBankName
        );
        const currentProduct = currentBank?.loanProducts.find(
          (p) => p.name === session.selectedProductName
        );
        const amount = parseFloat(userInput);
        if (
          currentProduct &&
          !isNaN(amount) &&
          amount >= currentProduct.minAmount &&
          amount <= currentProduct.maxAmount
        ) {
          nextSession.screen = 'APPLY_LOAN_CONFIRM';
          nextSession.loanAmount = amount;
          console.log(`[Handler] Loan amount entered: ${amount}`);
        } else {
          console.log(`[Handler] Invalid loan amount: ${userInput}`);
          responseMessage = `Invalid amount. Enter a number between ${currentProduct?.minAmount} and ${currentProduct?.maxAmount}.`;
        }
        break;

      case 'APPLY_LOAN_CONFIRM':
        if (userInput === '1') {
          console.log('[Handler] User confirmed loan application.');
          const { selectedBankName, selectedProductName, loanAmount } = session;
          const product = mockBanks
            .find((b) => b.name === selectedBankName)
            ?.loanProducts.find((p) => p.name === selectedProductName);
          
          if (selectedBankName && selectedProductName && loanAmount && product) {
            console.log('[Handler] Adding loan to database.');
            MockDatabase.addLoan(
              normalizedPhone,
              selectedBankName,
              selectedProductName,
              loanAmount,
              loanAmount * product.interestRate
            );
            responseMessage = `Loan application successful! Amount of ${loanAmount.toFixed(
              2
            )} for ${selectedProductName} has been credited to your account.`;
            responsePrefix = 'END';
            sessionManager.deleteSession(sessionId);
          } else {
            console.log('[Handler] Error during loan application (missing data).');
            responseMessage = 'An error occurred. Please try again.';
            goHome();
          }
        } else if (userInput === '2') {
          console.log('[Handler] User cancelled loan application.');
          responseMessage = 'Loan application cancelled.';
          goHome();
        } else {
          responseMessage = 'Invalid choice.';
        }
        break;

      case 'LOAN_STATUS':
        if (userInput === '9') {
          const userLoans = MockDatabase.getLoans(normalizedPhone);
          const pageSize = 2;
          if ((session.loanStatusPage + 1) * pageSize < userLoans.length) {
            nextSession.loanStatusPage = session.loanStatusPage + 1;
            console.log(`[Handler] Paginating loan status to page ${nextSession.loanStatusPage}`);
          }
        }
        break;

      case 'REPAY_SELECT_LOAN':
        const repayChoice = parseInt(userInput) - 1;
        if (
          session.repayLoans &&
          repayChoice >= 0 &&
          repayChoice < session.repayLoans.length
        ) {
          nextSession.screen = 'REPAY_ENTER_AMOUNT';
          nextSession.selectedRepayLoanId = session.repayLoans[repayChoice].id;
          console.log(`[Handler] Selected loan to repay: ID ${nextSession.selectedRepayLoanId}`);
        } else {
          console.log('[Handler] Invalid loan selection for repayment.');
          responseMessage = 'Invalid loan selection.';
        }
        break;

      case 'REPAY_ENTER_AMOUNT':
        const repayLoan = session.repayLoans?.find(
          (l) => l.id === session.selectedRepayLoanId
        );
        const repayAmount = parseFloat(userInput);
        if (repayLoan) {
          const outstanding =
            repayLoan.amount + repayLoan.interest - repayLoan.repaid;
          if (
            !isNaN(repayAmount) &&
            repayAmount > 0 &&
            repayAmount <= outstanding
          ) {
            console.log(`[Handler] Repaying loan with ${repayAmount}`);
            MockDatabase.repayLoan(normalizedPhone, repayLoan.id, repayAmount);
            responseMessage = `Repayment of ${repayAmount.toFixed(
              2
            )} was successful.`;
            responsePrefix = 'END';
            sessionManager.deleteSession(sessionId);
          } else {
            console.log(`[Handler] Invalid repayment amount: ${repayAmount}`);
            responseMessage = `Invalid amount. Enter a number between 1 and ${outstanding.toFixed(
              2
            )}.`;
          }
        }
        break;

      case 'LOAN_HISTORY':
        break;
    }
  }
  
  if (responsePrefix !== 'END') {
    console.log('[Handler] Updating session state.');
    sessionManager.updateSession(sessionId, nextSession);
  } else {
    console.log('[Handler] Session ended.');
  }
  
  if (responsePrefix === 'END') {
    return `${responsePrefix} ${responseMessage}`;
  }

  const menuText = getMenuText(nextSession);
  const finalMessage = `${responseMessage}${responseMessage ? '\n' : ''}${menuText}`;
  
  return `${responsePrefix} ${finalMessage}`;
}
