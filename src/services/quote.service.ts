import api from '../lib/api';

export interface HealthQuote {
    text: string;
    author: string;
}

class QuoteService {
    async getTodayQuote(): Promise<HealthQuote> {
        const response = await api.get<HealthQuote>('/quotes/today');
        return response.data;
    }
}

export const quoteService = new QuoteService();
