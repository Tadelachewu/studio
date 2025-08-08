
import { getMenuText } from '@/lib/menu';
import { MockDatabase } from '@/lib/mock-data';
import { sessionManager } from '@/lib/session';
import { normalizePhoneNumber } from '@/lib/utils';
import { type SessionData } from '@/lib/types';
import { translations } from '@/lib/translations';
import { getProviders, getProducts } from './api';

/**
 * Processes a USSD request that may have been forwarded from a parent application.
 * It handles the initial handoff and all subsequent user interactions.
 */
async function processProxiedRequest(
  sessionId: string,
  phoneNumber: string,
  text: string,
  forwardedPin: string | null,
  forwardedLanguage: 'en' | 'am' | null
): Promise<string> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const userInput = text.split('*').pop()?.trim() || '';

  let session = sessionManager.getSession(sessionId);
  let responsePrefix = 'CON';
  let responseMessage = '';

  // --- Handoff Logic ---
  // If there's no session, but we received forwarded data, it's a handoff.
  if (!session && forwardedPin && forwardedLanguage) {
    console.log('[Handler] Handoff detected. Creating and authenticating session.');
    
    // Create a new session
    session = sessionManager.createSession(sessionId, normalizedPhone);
    session.language = forwardedLanguage;

    // Check if the user is registered and verified
    const user = MockDatabase.getUserByPhoneNumber(normalizedPhone);
    const t = translations[session.language];
    if (!user) {
      return `END ${t.errors.notRegistered}`;
    }
    if (!user.isVerified) {
      return `END ${t.errors.notVerified}`;
    }

    // Authenticate with the forwarded PIN
    const correctPin = MockDatabase.getPin(normalizedPhone);
    if (correctPin && forwardedPin === correctPin) {
      session.authenticated = true;
      session.screen = 'HOME';
      responseMessage = `${t.loginSuccess}\n`;
    } else {
      // If the forwarded PIN is wrong, end the session.
      // The user must restart from the parent app.
      return `END ${t.errors.incorrectPin(1).split(':')[0]}`;
    }
    
    // We have authenticated and are ready to show the home screen.
    // The rest of the function will handle generating the menu text.
  } else if (!session) {
    // If there's no session and no forwarded data, start a normal flow.
    session = sessionManager.createSession(sessionId, normalizedPhone);
  }

  // If we are here, we have a session.
  // The rest of the logic is the standard USSD flow.
  const t = translations[session.language];

  // --- Standard USSD Flow (Language, PIN, Main Logic) ---

  if (session.screen === 'LANGUAGE_SELECT') {
    if (userInput === '1') {
      session.language = 'en';
      session.screen = 'PIN';
    } else if (userInput === '2') {
      session.language = 'am';
      session.screen = 'PIN';
    } else if (text.trim() !== '') {
      responseMessage = translations.en.errors.invalidLanguageChoice;
    }
    sessionManager.updateSession(sessionId, session);
    const menuText = getMenuText(session);
    return `CON ${responseMessage}${responseMessage ? '\n' : ''}${menuText}`;
  }

  const user = MockDatabase.getUserByPhoneNumber(normalizedPhone);
  if (!user) {
    sessionManager.deleteSession(sessionId);
    return `END ${t.errors.notRegistered}`;
  }
  if (!user.isVerified) {
    sessionManager.deleteSession(sessionId);
    return `END ${t.errors.notVerified}`;
  }

  if (!session.authenticated) {
    if (userInput) {
      if (!/^\d{4}$/.test(userInput)) {
        responseMessage = t.errors.invalidPinFormat;
      } else {
        const correctPin = MockDatabase.getPin(normalizedPhone);
        if (correctPin && userInput === correctPin) {
          session.authenticated = true;
          session.screen = 'HOME';
          session.pinAttempts = 0;
          responseMessage = `${t.loginSuccess}\n`;
        } else {
          session.pinAttempts++;
          if (session.pinAttempts >= 3) {
            sessionManager.deleteSession(sessionId);
            return `END ${t.errors.tooManyPinAttempts}`;
          }
          responseMessage = t.errors.incorrectPin(session.pinAttempts);
        }
      }
    }
    
    if (!session.authenticated) {
       sessionManager.updateSession(sessionId, session);
       const menuText = getMenuText(session);
       return `CON ${responseMessage ? responseMessage + '\n' : ''}${menuText}`;
    }
  }
  
  // --- Main Application Logic ---
  let nextSession: SessionData = { ...session };
  const goHome = () => { nextSession.screen = 'HOME'; };

  // Global navigation (0 for Home, 99 for Back)
  // Use 'userInput' for navigation to ensure it's always the latest choice.
  if (userInput === '0') {
    goHome();
  } else if (userInput === '99') {
    switch (session.screen) {
      case 'CHOOSE_PRODUCT': nextSession.screen = 'CHOOSE_PROVIDER'; break;
      case 'APPLY_LOAN_AMOUNT': nextSession.screen = 'CHOOSE_PRODUCT'; break;
      case 'APPLY_LOAN_CONFIRM': nextSession.screen = 'APPLY_LOAN_AMOUNT'; break;
      case 'REPAY_ENTER_AMOUNT': nextSession.screen = 'REPAY_SELECT_LOAN'; break;
      default: goHome(); break;
    }
  } else {
    // Screen-specific logic
    try {
      switch (session.screen) {
        case 'HOME':
          // The `userInput` is the most recent selection from the user.
          // In the case of a handoff, the first time this screen is shown, there is no real input yet.
          const effectiveUserInput = (forwardedPin && session.screen === 'HOME') ? '' : userInput;
          switch (effectiveUserInput) {
            case '1': // Apply for Loan
              const existingLoans = MockDatabase.getLoans(normalizedPhone);
              if (existingLoans.some(loan => loan.status === 'Active')) {
                responseMessage = t.errors.hasActiveLoan;
                responsePrefix = 'END';
              } else {
                  try {
                    nextSession.providers = await getProviders();
                    nextSession.screen = 'CHOOSE_PROVIDER';
                  } catch (e) {
                     responseMessage = t.errors.generic;
                     responsePrefix = 'END'; // End on API error for clarity
                  }
              }
              break;
            case '2': // Check Loan Status
              nextSession.screen = 'LOAN_STATUS';
              nextSession.loanStatusPage = 0;
              break;
            case '3': // Repay Loan
              nextSession.screen = 'REPAY_SELECT_LOAN';
              nextSession.repayLoans = MockDatabase.getLoans(normalizedPhone).filter(l => l.status === 'Active');
              break;
            case '4': // Check Balance
              const balance = MockDatabase.getBalance(normalizedPhone);
              responseMessage = t.balance(balance.toFixed(2));
              responsePrefix = 'END';
              break;
            case '5': // Loan History
              nextSession.screen = 'LOAN_HISTORY';
              break;
            case '0': // Exit from Home
              responseMessage = t.exitMessage;
              responsePrefix = 'END';
              break;
            default:
              // Only show invalid choice if there was an actual input
              if (effectiveUserInput) {
                responseMessage = t.errors.invalidChoice;
              }
              break;
          }
          break;

        case 'CHOOSE_PROVIDER':
          const providerChoice = parseInt(userInput) - 1;
          if (session.providers && providerChoice >= 0 && providerChoice < session.providers.length) {
            nextSession.selectedProviderId = session.providers[providerChoice].id;
             try {
                nextSession.products = await getProducts(session.providers[providerChoice].id);
                nextSession.productPage = 0;
                nextSession.screen = 'CHOOSE_PRODUCT';
             } catch (e) {
                responseMessage = t.errors.generic;
                goHome();
             }
          } else if (userInput) {
            responseMessage = t.errors.invalidChoice;
          }
          break;

        case 'CHOOSE_PRODUCT':
          const products = session.products || [];
           if (userInput === '8' && nextSession.productPage !== undefined) { // Next
              if ((nextSession.productPage + 1) * 2 < products.length) {
                nextSession.productPage++;
              }
          } else if (userInput === '7' && nextSession.productPage !== undefined && nextSession.productPage > 0) { // Prev
              nextSession.productPage--;
          } else {
            const productChoice = parseInt(userInput) - 1;
            if (productChoice >= 0 && productChoice < products.length) {
              nextSession.selectedProductId = products[productChoice].id;
              nextSession.screen = 'APPLY_LOAN_AMOUNT';
            } else if (userInput) {
              responseMessage = t.errors.invalidChoice;
            }
          }
          break;

        case 'APPLY_LOAN_AMOUNT':
          const product = session.products?.find(p => p.id === session.selectedProductId);
          const amount = parseFloat(userInput);
          if (!product) {
            responseMessage = t.errors.productNotFound;
            goHome();
          } else if (userInput && !isNaN(amount) && amount >= product.minAmount && amount <= product.maxAmount) {
            nextSession.loanAmount = amount;
            nextSession.screen = 'APPLY_LOAN_CONFIRM';
          } else if (userInput) {
            responseMessage = t.errors.invalidAmount(product.minAmount, product.maxAmount);
          }
          break;

        case 'APPLY_LOAN_CONFIRM':
          const provider = session.providers?.find(p => p.id === session.selectedProviderId);
          const confirmProduct = session.products?.find(p => p.id === session.selectedProductId);
          if (userInput === '1' && provider && confirmProduct && session.loanAmount) {
            MockDatabase.addLoan(normalizedPhone, provider.name, confirmProduct.name, session.loanAmount, session.loanAmount * confirmProduct.interestRate);
            responseMessage = t.loanSuccess(session.loanAmount.toFixed(2), confirmProduct.name);
            responsePrefix = 'END';
          } else if (userInput === '2') {
            responseMessage = t.loanCancelled;
            goHome();
          } else if (userInput) {
            responseMessage = t.errors.invalidChoice;
          }
          break;

        case 'LOAN_STATUS':
          if (userInput === '9') { // More
            const userLoans = MockDatabase.getLoans(normalizedPhone);
            const currentPage = session.loanStatusPage || 0;
            if ((currentPage + 1) * 2 < userLoans.length) {
              nextSession.loanStatusPage = currentPage + 1;
            }
          }
          break;
          
        case 'REPAY_SELECT_LOAN':
           const repayChoice = parseInt(userInput) - 1;
           if (session.repayLoans && repayChoice >= 0 && repayChoice < session.repayLoans.length) {
             nextSession.selectedRepayLoanId = session.repayLoans[repayChoice].id;
             nextSession.screen = 'REPAY_ENTER_AMOUNT';
           } else if (userInput) {
             responseMessage = t.errors.invalidChoice;
           }
          break;

        case 'REPAY_ENTER_AMOUNT':
          const loanToRepay = session.repayLoans?.find(l => l.id === session.selectedRepayLoanId);
          const repayAmount = parseFloat(userInput);
          if (!loanToRepay) {
            responseMessage = t.errors.loanNotFound;
            goHome();
          } else {
            const outstanding = loanToRepay.amount + loanToRepay.interest - loanToRepay.repaid;
            if (userInput && !isNaN(repayAmount) && repayAmount > 0 && repayAmount <= outstanding) {
              MockDatabase.repayLoan(normalizedPhone, loanToRepay.id, repayAmount);
              responseMessage = t.repaymentSuccess(repayAmount.toFixed(2));
              responsePrefix = 'END';
            } else if (userInput) {
              responseMessage = t.errors.invalidRepayment(outstanding.toFixed(2));
            }
          }
          break;
        case 'LOAN_HISTORY':
            // No user input expected on this screen other than global nav
            break;
      }
    } catch (error) {
      console.error('[Handler] API or Logic Error:', error);
      responseMessage = t.errors.generic;
      goHome();
    }
  }

  if (responsePrefix === 'END') {
    sessionManager.deleteSession(sessionId);
    return `END ${responseMessage}`;
  }
  
  sessionManager.updateSession(sessionId, nextSession);
  const menuText = getMenuText(nextSession);
  return `CON ${responseMessage}${responseMessage ? '\n' : ''}${menuText}`;
}


export async function processUssdRequest(
  sessionId: string,
  phoneNumber: string,
  text: string,
  forwardedPin: string | null,
  forwardedLanguage: 'en' | 'am' | null
): Promise<string> {
  // This function now orchestrates the handoff and subsequent processing.
  return await processProxiedRequest(sessionId, phoneNumber, text, forwardedPin, forwardedLanguage);
}
