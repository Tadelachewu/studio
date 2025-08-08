
import { getMenuText } from '@/lib/menu';
import { MockDatabase } from '@/lib/mock-data';
import { sessionManager } from '@/lib/session';
import { normalizePhoneNumber } from '@/lib/utils';
import { type SessionData } from '@/lib/types';
import { translations } from '@/lib/translations';
import { getProviders, getProducts } from './api';

async function processIncomingRequest(
  sessionId: string,
  phoneNumber: string,
  text: string,
  forwardedPin: string | null,
  forwardedLanguage: 'en' | 'am' | null
): Promise<string> {
  console.log('[Handler] Processing request:', { sessionId, phoneNumber, text, forwardedPin, forwardedLanguage });
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const userInput = text.split('*').pop()?.trim() || '';

  let session = sessionManager.getSession(sessionId);
  let responsePrefix = 'CON';
  let responseMessage = '';

  if (!session) {
    console.log('[Handler] No session found, creating a new one.');
    session = sessionManager.createSession(sessionId, normalizedPhone);
  }

  // --- Integration Logic: Handle forwarded request from parent USSD ---
  if (forwardedPin && forwardedLanguage && !session.authenticated) {
    console.log('[Handler] Forwarded session detected. Authenticating...');
    const user = MockDatabase.getUserByPhoneNumber(normalizedPhone);
    const correctPin = MockDatabase.getPin(normalizedPhone);
    if (user && correctPin === forwardedPin) {
      session.authenticated = true;
      session.language = forwardedLanguage;
      session.screen = 'HOME';
      session.pinAttempts = 0;
      const t = translations[session.language];
      responseMessage = `${t.loginSuccess}\n`;
    }
  }
  // --- End of Integration Logic ---

  // Handle language selection if not authenticated (for direct access)
  if (session.screen === 'LANGUAGE_SELECT') {
    if (userInput === '1') {
      session.language = 'en';
      session.screen = 'PIN';
    } else if (userInput === '2') {
      session.language = 'am';
      session.screen = 'PIN';
    } else if (text.trim() !== '') { // Only show error if there was some input
      responseMessage = translations.en.errors.invalidLanguageChoice; // Show in both languages
    }
    
    sessionManager.updateSession(sessionId, session);
    const menuText = getMenuText(session);
    const finalMessage = `${responseMessage}${responseMessage ? '\n' : ''}${menuText}`;
    return `${responsePrefix} ${finalMessage}`;
  }

  const t = translations[session.language];

  const user = MockDatabase.getUserByPhoneNumber(normalizedPhone);
  if (!user) {
    console.log(`[Handler] User not found for phone: ${normalizedPhone}. Ending session.`);
    responsePrefix = 'END';
    responseMessage = t.errors.notRegistered;
    sessionManager.deleteSession(sessionId);
    return `${responsePrefix} ${responseMessage}`;
  }
  console.log('[Handler] User found:', { phoneNumber: user.phoneNumber, isVerified: user.isVerified });

  if (!user.isVerified) {
    console.log('[Handler] User is not verified. Ending session.');
    responsePrefix = 'END';
    responseMessage = t.errors.notVerified;
    sessionManager.deleteSession(sessionId);
    return `${responsePrefix} ${responseMessage}`;
  }
  
  if (!session.authenticated) {
    console.log('[Handler] User not authenticated. Checking PIN.');
    if (userInput !== '') {
      const isPinFormatValid = /^\d{4}$/.test(userInput);
      if (!isPinFormatValid) {
        responseMessage = t.errors.invalidPinFormat;
      } else {
        const correctPin = MockDatabase.getPin(normalizedPhone);
        if (correctPin && userInput === correctPin) {
          console.log('[Handler] PIN correct. Authenticating session.');
          session.authenticated = true;
          session.screen = 'HOME';
          session.pinAttempts = 0;
          responseMessage = `${t.loginSuccess}\n`;
        } else {
          session.pinAttempts++;
          console.log(`[Handler] Incorrect PIN. Attempt ${session.pinAttempts}.`);
          if (session.pinAttempts >= 3) {
            console.log('[Handler] Too many PIN attempts. Ending session.');
            responseMessage = t.errors.tooManyPinAttempts;
            responsePrefix = 'END';
            sessionManager.deleteSession(sessionId);
          } else {
            responseMessage = t.errors.incorrectPin(session.pinAttempts);
          }
        }
      }
    }
    
    if (responsePrefix !== 'END') {
      sessionManager.updateSession(sessionId, session);
      if (!session.authenticated) {
          console.log('[Handler] Staying on PIN screen.');
          const menuText = getMenuText(session);
          return `${responsePrefix} ${responseMessage ? responseMessage + '\n' : ''}${menuText}`;
      }
    } else {
        return `${responsePrefix} ${responseMessage}`;
    }
  }

  let nextSession: SessionData = { ...session };
  console.log(`[Handler] Processing screen: "${session.screen}" with input: "${userInput}"`);

  const goHome = () => {
    console.log('[Handler] Navigating to HOME screen.');
    nextSession.screen = 'HOME';
    delete nextSession.providers;
    delete nextSession.products;
    delete nextSession.selectedProviderId;
    delete nextSession.selectedProductId;
    delete nextSession.loanAmount;
  };
  
  // Navigation (0 and 99) is handled globally for all screens after the main menu
  if (session.screen !== 'HOME' && session.screen !== 'PIN' && session.screen !== 'LANGUAGE_SELECT') {
    if (userInput === '0') {
      goHome();
    } else if (userInput === '99') {
      console.log(`[Handler] Going back from ${session.screen}`);
      switch (session.screen) {
        case 'CHOOSE_PRODUCT':
          nextSession.screen = 'CHOOSE_PROVIDER';
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
        // For these screens, "Back" is equivalent to "Home"
        case 'CHOOSE_PROVIDER':
        case 'LOAN_STATUS':
        case 'REPAY_SELECT_LOAN':
        case 'LOAN_HISTORY':
          goHome();
          break;
      }
    }
  }

  // Only process screen logic if we haven't already handled navigation
  if (nextSession.screen === session.screen) {
    try {
      switch (session.screen) {
        case 'HOME':
          console.log(`[Handler] HOME selection: "${userInput}"`);
          switch (userInput) {
            case '1':
              const existingLoans = MockDatabase.getLoans(normalizedPhone);
              const hasActiveLoan = existingLoans.some(loan => loan.status === 'Active');
              if (hasActiveLoan) {
                  console.log('[Handler] User has an active loan.');
                  responseMessage = t.errors.hasActiveLoan;
                  responsePrefix = 'END';
                  sessionManager.deleteSession(sessionId);
              } else {
                  console.log('[Handler] Starting loan application flow.');
                  nextSession.screen = 'CHOOSE_PROVIDER';
                  try {
                      nextSession.providers = await getProviders();
                      console.log('[Handler] Fetched providers:', nextSession.providers);
                  } catch (apiError) {
                      console.error('[Handler] API Error fetching providers:', apiError);
                      responseMessage = t.errors.generic;
                      goHome();
                  }
              }
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
              responseMessage = t.balance(balance.toFixed(2));
              responsePrefix = 'END';
              sessionManager.deleteSession(sessionId);
              break;
            case '5':
              nextSession.screen = 'LOAN_HISTORY';
              break;
            case '0':
              responseMessage = t.exitMessage;
              responsePrefix = 'END';
              sessionManager.deleteSession(sessionId);
              break;
            default:
              if (userInput !== '') {
                 responseMessage = t.errors.invalidChoice;
              }
              break;
          }
          console.log(`[Handler] Next screen after HOME: "${nextSession.screen}"`);
          break;

        case 'CHOOSE_PROVIDER':
          const providerChoice = parseInt(userInput) - 1;
          const providers = session.providers || [];
          if (providerChoice >= 0 && providerChoice < providers.length) {
              nextSession.screen = 'CHOOSE_PRODUCT';
              nextSession.selectedProviderId = providers[providerChoice].id;
              try {
                  nextSession.products = await getProducts(providers[providerChoice].id);
                  nextSession.productPage = 0;
                  console.log(`[Handler] Provider chosen: "${providers[providerChoice].name}"`);
              } catch (apiError) {
                  console.error('[Handler] API Error fetching products:', apiError);
                  responseMessage = t.errors.generic;
                  goHome();
              }
          } else {
            console.log('[Handler] Invalid provider choice.');
            responseMessage = t.errors.invalidChoice;
          }
          break;

        case 'CHOOSE_PRODUCT':
          const products = session.products || [];
          if (userInput === '8') { // Next
              const currentPage = nextSession.productPage || 0;
              if ((currentPage + 1) * 2 < products.length) {
                nextSession.productPage = currentPage + 1;
              }
              break;
          }
          if (userInput === '7') { // Previous
              const currentPage = nextSession.productPage || 0;
              if (currentPage > 0) {
                nextSession.productPage = currentPage - 1;
              }
              break;
          }

          const productChoice = parseInt(userInput) - 1;
          const isValidProductChoice = productChoice >= 0 && productChoice < products.length;

          if (isValidProductChoice) {
            nextSession.screen = 'APPLY_LOAN_AMOUNT';
            nextSession.selectedProductId = products[productChoice].id;
            console.log(`[Handler] Product chosen: "${products[productChoice].name}"`);
          } else {
            console.log('[Handler] Invalid product choice.');
            responseMessage = t.errors.invalidChoice;
          }
          break;

        case 'APPLY_LOAN_AMOUNT':
          const currentProduct = session.products?.find(
              p => p.id === session.selectedProductId
          );
          const amount = parseFloat(userInput);
          if (!currentProduct) {
            responseMessage = t.errors.productNotFound;
            goHome();
          } else if (
            !isNaN(amount) &&
            amount >= currentProduct.minAmount &&
            amount <= currentProduct.maxAmount
          ) {
            nextSession.screen = 'APPLY_LOAN_CONFIRM';
            nextSession.loanAmount = amount;
            console.log(`[Handler] Loan amount entered: ${amount}`);
          } else {
            console.log(`[Handler] Invalid loan amount: ${userInput}`);
            responseMessage = t.errors.invalidAmount(currentProduct.minAmount, currentProduct.maxAmount);
          }
          break;

        case 'APPLY_LOAN_CONFIRM':
          if (userInput === '1') {
            console.log('[Handler] User confirmed loan application.');
            const { selectedProviderId, selectedProductId, loanAmount } = session;
            const provider = session.providers?.find(p => p.id === selectedProviderId);
            const product = session.products?.find(p => p.id === selectedProductId);
            
            if (provider && product && loanAmount) {
              console.log('[Handler] Adding loan to database.');
              MockDatabase.addLoan(
                normalizedPhone,
                provider.name,
                product.name,
                loanAmount,
                loanAmount * product.interestRate
              );
              responseMessage = t.loanSuccess(loanAmount.toFixed(2), product.name);
              responsePrefix = 'END';
              sessionManager.deleteSession(sessionId);
            } else {
              console.log('[Handler] Error during loan application (missing data).');
              responseMessage = t.errors.generic;
              goHome();
            }
          } else if (userInput === '2') {
            console.log('[Handler] User cancelled loan application.');
            responseMessage = t.loanCancelled;
            goHome();
          } else {
            responseMessage = t.errors.invalidChoice;
          }
          break;

        case 'LOAN_STATUS':
          if (userInput === '9') { // More
            const userLoans = MockDatabase.getLoans(normalizedPhone);
            const pageSize = 2;
            const currentPage = session.loanStatusPage || 0;
            if ((currentPage + 1) * pageSize < userLoans.length) {
              nextSession.loanStatusPage = currentPage + 1;
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
            responseMessage = t.errors.invalidChoice;
          }
          break;

        case 'REPAY_ENTER_AMOUNT':
          const repayLoan = session.repayLoans?.find(
            (l) => l.id === session.selectedRepayLoanId
          );
          const repayAmount = parseFloat(userInput);
          if (!repayLoan) {
            responseMessage = t.errors.loanNotFound;
            goHome();
          } else {
            const outstanding =
              repayLoan.amount + repayLoan.interest - repayLoan.repaid;
            if (
              !isNaN(repayAmount) &&
              repayAmount > 0 &&
              repayAmount <= outstanding
            ) {
              console.log(`[Handler] Repaying loan with ${repayAmount}`);
              MockDatabase.repayLoan(normalizedPhone, repayLoan.id, repayAmount);
              responseMessage = t.repaymentSuccess(repayAmount.toFixed(2));
              responsePrefix = 'END';
              sessionManager.deleteSession(sessionId);
            } else {
              console.log(`[Handler] Invalid repayment amount: ${repayAmount}`);
              responseMessage = t.errors.invalidRepayment(outstanding.toFixed(2));
            }
          }
          break;

        case 'LOAN_HISTORY':
          // No user input is handled here, it just displays information.
          // Navigation to home (0) is handled globally.
          break;
      }
    } catch (error) {
          console.error('[Handler] An unexpected error occurred:', error);
          responseMessage = t.errors.generic;
          goHome();
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

export async function processUssdRequest(
  sessionId: string,
  phoneNumber: string,
  text: string,
  forwardedPin: string | null,
  forwardedLanguage: 'en' | 'am' | null
): Promise<string> {
    return await processIncomingRequest(sessionId, phoneNumber, text, forwardedPin, forwardedLanguage)
}
