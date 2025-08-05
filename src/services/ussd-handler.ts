import { getMenuText } from '@/lib/menu';
import { mockBanks, MockDatabase } from '@/lib/mock-data';
import { sessionManager } from '@/lib/session';
import { normalizePhoneNumber } from '@/lib/utils';

export function processUssdRequest(
  sessionId: string,
  phoneNumber: string,
  userInput: string
): string {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  let session = sessionManager.getSession(sessionId);
  let responsePrefix = 'CON';
  let responseMessage = '';

  if (!session) {
    session = sessionManager.createSession(sessionId, normalizedPhone);
  }

  const user = MockDatabase.getUserByPhoneNumber(normalizedPhone);
  if (!user) {
    // This case should ideally not happen if phone numbers are controlled
    // but as a safeguard:
    responsePrefix = 'END';
    responseMessage = 'Your phone number is not registered.';
    sessionManager.deleteSession(sessionId);
    return `${responsePrefix} ${responseMessage}`;
  }

  if (!user.isVerified && session.screen !== 'PIN') {
    responsePrefix = 'END';
    responseMessage =
      'Your account is not verified. Please contact customer support.';
    sessionManager.deleteSession(sessionId);
    return `${responsePrefix} ${responseMessage}`;
  }

  // This is the first interaction for a verified user
  if (!session.authenticated && session.screen === 'PIN' && userInput === '') {
      // Let it fall through to show the PIN entry menu
  } else if (!session.authenticated) {
    // All subsequent interactions before auth must be PIN validation
    const pin = MockDatabase.getPin(normalizedPhone);
    if (pin && userInput.length === 4 && /^\d+$/.test(userInput)) {
      if (userInput === pin) {
        session.authenticated = true;
        session.screen = 'HOME';
        session.pinAttempts = 0;
        responseMessage = 'Login successful.\n'; // Explicit notification
      } else {
        session.pinAttempts++;
        if (session.pinAttempts >= 3) {
          responseMessage = `Too many incorrect PIN attempts. Session ended.`;
          responsePrefix = 'END';
          sessionManager.deleteSession(sessionId);
        } else {
          responseMessage = `Incorrect PIN. Attempt ${session.pinAttempts} of 3. Try again:`;
        }
      }
    } else {
      // This handles the very first time the user sees the PIN screen
      // or invalid PIN formats
      responseMessage = session.pinAttempts > 0 
        ? `Incorrect PIN. Attempt ${session.pinAttempts} of 3. Try again:`
        : `Welcome to Mobili Finance. Please enter your 4-digit PIN:`;
    }
    
    // If not authenticated and not exiting, we stay on the PIN screen
    if (!session.authenticated && responsePrefix !== 'END') {
       sessionManager.updateSession(sessionId, session);
       const menuText = getMenuText(session);
       return `${responsePrefix} ${responseMessage || menuText}`;
    }
  }


  let nextSession = { ...session };

  const goHome = () => {
    nextSession.screen = 'HOME';
  };

  switch (session.screen) {
    case 'PIN':
      // This case is now only for the first successful login, to transition to HOME
      if (session.authenticated) {
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
          nextSession.screen = 'TRANSACTION_HISTORY';
          break;
        case '6':
          nextSession.screen = 'CHANGE_PIN';
          break;
        case '0':
          responseMessage = 'Thank you for using Microloan USSD.';
          responsePrefix = 'END';
          sessionManager.deleteSession(sessionId);
          break;
        default:
          // Handles the case where a user logs in and gets the success message,
          // then the home menu is appended.
          if (responseMessage.includes('Login successful')) {
             break;
          }
          responseMessage = 'Invalid choice.';
          break;
      }
      break;

    case 'CHOOSE_BANK':
      if (userInput === '0') {
        goHome();
        break;
      }
      const bankChoice = parseInt(userInput) - 1;
      if (bankChoice >= 0 && bankChoice < mockBanks.length) {
        nextSession.screen = 'CHOOSE_PRODUCT';
        nextSession.selectedBankName = mockBanks[bankChoice].name;
      } else {
        responseMessage = 'Invalid bank choice.';
      }
      break;

    case 'CHOOSE_PRODUCT':
      if (userInput === '0') {
        goHome();
        break;
      }
      if (userInput === '99') {
        nextSession.screen = 'CHOOSE_BANK';
        break;
      }

      const bank = mockBanks.find((b) => b.name === session.selectedBankName);
      if (bank) {
        const productChoice = parseInt(userInput) - 1;
        if (
          productChoice >= 0 &&
          productChoice < bank.loanProducts.length
        ) {
          nextSession.screen = 'APPLY_LOAN_AMOUNT';
          nextSession.selectedProductName =
            bank.loanProducts[productChoice].name;
        } else {
          responseMessage = 'Invalid product choice.';
        }
      }
      break;

    case 'APPLY_LOAN_AMOUNT':
      if (userInput === '0') {
        goHome();
        break;
      }
      if (userInput === '99') {
        nextSession.screen = 'CHOOSE_PRODUCT';
        break;
      }

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
      } else {
        responseMessage = `Invalid amount. Enter a number between ${currentProduct?.minAmount} and ${currentProduct?.maxAmount}.`;
      }
      break;

    case 'APPLY_LOAN_CONFIRM':
      if (userInput === '0') {
        goHome();
        break;
      }
      if (userInput === '99') {
        nextSession.screen = 'APPLY_LOAN_AMOUNT';
        break;
      }

      if (userInput === '1') {
        const { selectedBankName, selectedProductName, loanAmount } = session;
        const product = mockBanks
          .find((b) => b.name === selectedBankName)
          ?.loanProducts.find((p) => p.name === selectedProductName);
        
        const existingLoans = MockDatabase.getLoans(normalizedPhone);
        const hasActiveLoanFromSameBank = existingLoans.some(
          (loan) => loan.bankName === selectedBankName && loan.status === 'Active'
        );

        if (hasActiveLoanFromSameBank) {
            responseMessage = `You already have an active loan with ${selectedBankName}. Please repay it before applying for a new one.`;
            responsePrefix = 'END';
            sessionManager.deleteSession(sessionId);
            break;
        }

        if (selectedBankName && selectedProductName && loanAmount && product) {
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
          responseMessage = 'An error occurred. Please try again.';
          goHome();
        }
      } else {
        responseMessage = 'Invalid choice.';
      }
      break;

    case 'LOAN_STATUS':
      if (userInput === '0') {
        goHome();
        break;
      }
      if (userInput === '9') {
        const userLoans = MockDatabase.getLoans(normalizedPhone);
        const pageSize = 2;
        if ((session.loanStatusPage + 1) * pageSize < userLoans.length) {
          nextSession.loanStatusPage = session.loanStatusPage + 1;
        }
      }
      break;

    case 'REPAY_SELECT_LOAN':
      if (userInput === '0') {
        goHome();
        break;
      }
      const repayChoice = parseInt(userInput) - 1;
      if (
        session.repayLoans &&
        repayChoice >= 0 &&
        repayChoice < session.repayLoans.length
      ) {
        nextSession.screen = 'REPAY_ENTER_AMOUNT';
        nextSession.selectedRepayLoanId = session.repayLoans[repayChoice].id;
      } else {
        responseMessage = 'Invalid loan selection.';
      }
      break;

    case 'REPAY_ENTER_AMOUNT':
      if (userInput === '0') {
        goHome();
        break;
      }
      if (userInput === '99') {
        nextSession.screen = 'REPAY_SELECT_LOAN';
        break;
      }

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
          MockDatabase.repayLoan(normalizedPhone, repayLoan.id, repayAmount);
          responseMessage = `Repayment of ${repayAmount.toFixed(
            2
          )} was successful.`;
          responsePrefix = 'END';
          sessionManager.deleteSession(sessionId);
        } else {
          responseMessage = `Invalid amount. Enter a number between 1 and ${outstanding.toFixed(
            2
          )}.`;
        }
      }
      break;

    case 'CHANGE_PIN':
      if (userInput === '0') {
        goHome();
        break;
      }
      if (userInput.length === 4 && /^\d+$/.test(userInput)) {
        MockDatabase.setPin(normalizedPhone, userInput);
        responseMessage = 'Your PIN has been changed successfully.';
        responsePrefix = 'END';
        sessionManager.deleteSession(sessionId);
      } else {
        responseMessage = 'Invalid PIN format. Enter a new 4-digit PIN.';
      }
      break;

    case 'TRANSACTION_HISTORY':
      if (userInput === '0') {
        goHome();
        break;
      }
      break;
  }
  
  // Update the session only if the session is not marked for deletion
  if (responsePrefix !== 'END') {
    sessionManager.updateSession(sessionId, nextSession);
  }
  
  const finalMessage = responseMessage + (responseMessage && nextSession.screen === 'HOME' ? '\n' : '') + getMenuText(nextSession);
  return `${responsePrefix} ${finalMessage}`;
}
