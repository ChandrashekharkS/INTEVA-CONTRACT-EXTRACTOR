
import type { Document } from '../types';
import { initialDocuments } from './mockData';

const API_BASE_URL = '/api';

// Helper to handle responses and check for non-JSON content
const handleResponse = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return response.json();
    } else {
        const text = await response.text();
        if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
            throw new Error("Backend server is unreachable (Returned HTML).");
        }
        throw new Error(text || `Server error: ${response.status}`);
    }
};

export const fetchContracts = async (company?: string, months?: number, days?: number): Promise<Document[]> => {
    try {
        let url = `${API_BASE_URL}/contracts?`;
        const params = new URLSearchParams();
        
        if (company) params.append('company', company);
        if (months) params.append('months', months.toString());
        if (days) params.append('days', days.toString());
        
        const response = await fetch(url + params.toString());
        if (!response.ok) {
            // Check specifically for 404 which might mean the proxy failed or route is missing
            if (response.status === 404) {
                console.warn('Backend route not found (404). Switching to offline mode.');
            }
            throw new Error(`Server status: ${response.status}`);
        }
        return await handleResponse(response);
    } catch (error) {
        // Fallback logic for ANY fetch error (network, 404, 500, parsing)
        console.warn('Using client-side mock data due to API error:', error);
        
        // Client-side filtering logic to mimic backend behavior
        let docs = [...initialDocuments];
        
        if (company) {
            docs = docs.filter(d => d.data?.clientName === company);
        }
        if (months) {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - months);
            docs = docs.filter(d => new Date(d.processedDate) >= cutoff);
        }
        if (days) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            docs = docs.filter(d => new Date(d.processedDate) >= cutoff);
        }
        // Sort by date descending
        docs.sort((a, b) => new Date(b.processedDate).getTime() - new Date(a.processedDate).getTime());
        return docs;
    }
};

export const fetchCompanies = async (): Promise<string[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/companies`);
        if (!response.ok) {
            throw new Error('Failed to fetch companies');
        }
        return await handleResponse(response);
    } catch (error) {
        console.warn('Backend API unreachable. Using unique companies from mock data.');
        const companies = Array.from(new Set(initialDocuments.map(doc => doc.data?.clientName || 'N/A').filter(c => c !== 'N/A')));
        return companies.sort();
    }
};

export const deleteContract = async (id: string): Promise<void> => {
    try {
        const response = await fetch(`${API_BASE_URL}/contracts/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error('Failed to delete contract');
        }
    } catch (error) {
        // In offline mode, we just simulate success so the UI updates
        console.warn('Backend API unreachable. Simulating delete in offline mode.');
        return;
    }
};
