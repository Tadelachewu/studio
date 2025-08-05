import { normalizePhoneNumber } from '@/lib/utils';

export interface LoanProduct {
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number; // e.g., 0.08 for 8%
}

export interface Bank {
  name: string;
  loanProducts: LoanProduct[];
}

export interface MockLoan {
  id: string;
  bankName: string;
  productName: string;
  amount: number;
  interest: number;
  repaid: number;
  status: 'Active' | 'Paid Off';
  date: Date;
}

export interface MockUser {
  phoneNumber: string;
  pin: string;
  fayidaId: string;
  isVerified: boolean;
}

export const mockBanks: Bank[] = [
  {
    name: 'NIB Bank',
    loanProducts: [
      {
        name: 'Personal Loan',
        minAmount: 1000,
        maxAmount: 5000,
        interestRate: 0.1,
      },
      {
        name: 'Business Starter',
        minAmount: 5000,
        maxAmount: 20000,
        interestRate: 0.08,
      },
    ],
  },
  {
    name: 'Dashen Bank',
    loanProducts: [
      {
        name: 'Student Loan',
        minAmount: 500,
        maxAmount: 2500,
        interestRate: 0.05,
      },
      {
        name: 'Emergency Fund',
        minAmount: 200,
        maxAmount: 1000,
        interestRate: 0.12,
      },
    ],
  },
  {
    name: 'CBE',
    loanProducts: [
      {
        name: 'Salary Advance',
        minAmount: 1500,
        maxAmount: 10000,
        interestRate: 0.09,
      },
    ],
  },
  {
    name: 'Awash Bank',
    loanProducts: [
      {
        name: 'Agri-Loan',
        minAmount: 2000,
        maxAmount: 15000,
        interestRate: 0.07,
      },
    ],
  },
];

const mockUsers: MockUser[] = [
  {
    phoneNumber: '+251900000001',
    pin: '1234',
    fayidaId: '1235678',
    isVerified: true,
  },
  {
    phoneNumber: '+251900000002',
    pin: '5678',
    fayidaId: '87654321',
    isVerified: true,
  },
  {
    phoneNumber: '+251900000003',
    pin: '4321',
    fayidaId: '11223344',
    isVerified: false,
  },
];

const initialUserLoans: Record<string, MockLoan[]> = {
  '+251900000001': [
    {
      id: 'loan1',
      bankName: 'Dashen Bank',
      productName: 'Emergency Fund',
      amount: 500,
      interest: 60,
      repaid: 100,
      status: 'Active',
      date: new Date('2023-10-15'),
    },
  ],
  '+251900000002': [
    {
      id: 'loan2',
      bankName: 'NIB Bank',
      productName: 'Business Starter',
      amount: 10000,
      interest: 800,
      repaid: 2000,
      status: 'Active',
      date: new Date('2023-11-01'),
    },
    {
      id: 'loan3',
      bankName: 'Dashen Bank',
      productName: 'Student Loan',
      amount: 2000,
      interest: 100,
      repaid: 2100,
      status: 'Paid Off',
      date: new Date('2023-09-20'),
    },
  ],
};

const userBalances: Record<string, number> = {
  '+251900000001': 5000.0,
  '+251900000002': 12500.75,
  '+251900000003': 800.5,
};

const userTransactions: Record<string, string[]> = {
  '+251900000001': ['Repayment of 100.00 to Dashen Bank'],
  '+251900000002': [
    'Loan of 10000.00 from NIB Bank',
    'Repayment of 2000.00 to NIB Bank',
  ],
};

// In-memory database object
export const MockDatabase = {
  users: [...mockUsers],
  userLoans: JSON.parse(JSON.stringify(initialUserLoans)) as Record<
    string,
    MockLoan[]
  >, // Deep copy
  userBalances: { ...userBalances },
  userTransactions: JSON.parse(JSON.stringify(userTransactions)) as Record<
    string,
    string[]
  >,

  getUserByPhoneNumber(phoneNumber: string): MockUser | undefined {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    return this.users.find((u) => u.phoneNumber === normalizedPhone);
  },
  getPin(phoneNumber: string): string | undefined {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    return this.users.find((u) => u.phoneNumber === normalizedPhone)?.pin;
  },
  setPin(phoneNumber: string, newPin: string) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const user = this.users.find((u) => u.phoneNumber === normalizedPhone);
    if (user) {
      user.pin = newPin;
    }
  },
  getLoans(phoneNumber: string): MockLoan[] {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    return this.userLoans[normalizedPhone] || [];
  },
  addLoan(
    phoneNumber: string,
    bankName: string,
    productName: string,
    amount: number,
    interest: number
  ) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!this.userLoans[normalizedPhone]) {
      this.userLoans[normalizedPhone] = [];
    }
    if (!this.userTransactions[normalizedPhone]) {
      this.userTransactions[normalizedPhone] = [];
    }
    const newLoan: MockLoan = {
      id: `loan${Date.now()}`,
      bankName,
      productName,
      amount,
      interest,
      repaid: 0,
      status: 'Active',
      date: new Date(),
    };
    this.userLoans[normalizedPhone].push(newLoan);
    this.userBalances[normalizedPhone] =
      (this.userBalances[normalizedPhone] || 0) + amount;
    this.userTransactions[normalizedPhone].push(
      `Loan of ${amount.toFixed(2)} from ${bankName}`
    );
  },
  repayLoan(phoneNumber: string, loanId: string, repayAmount: number) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const loan = this.userLoans[normalizedPhone]?.find((l) => l.id === loanId);
    if (loan) {
      loan.repaid += repayAmount;
      if (loan.repaid >= loan.amount + loan.interest) {
        loan.status = 'Paid Off';
      }
      this.userBalances[normalizedPhone] =
        (this.userBalances[normalizedPhone] || 0) - repayAmount;
      if (!this.userTransactions[normalizedPhone]) {
        this.userTransactions[normalizedPhone] = [];
      }
      this.userTransactions[normalizedPhone].push(
        `Repayment of ${repayAmount.toFixed(2)} to ${loan.bankName}`
      );
      return true;
    }
    return false;
  },
  getBalance(phoneNumber: string): number {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    return this.userBalances[normalizedPhone] || 0;
  },
  getTransactions(phoneNumber: string): string[] {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    return this.userTransactions[normalizedPhone] || [];
  },
};
