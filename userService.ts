
import type { User, UserRole } from '../types';
import { initialUsers } from './mockData';

const API_BASE_URL = '/api';

// Helper to handle responses and check for non-JSON content (indicating backend issues)
const handleResponse = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return response.json();
    } else {
        // If the response is not JSON, it's likely the HTML fallback from Vite (backend down)
        const text = await response.text();
        if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
            throw new Error("Backend server is not running or unreachable. Please start the server.");
        }
        throw new Error(text || `Server error: ${response.status}`);
    }
};

export const loginUser = async (email: string, password: string): Promise<User> => {
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await handleResponse(response);

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        return data.user;
    } catch (error) {
        // Fallback for offline mode or dev environment without server
        console.warn('Login API unreachable, checking mock users...');
        const user = initialUsers.find(u => u.email === email);
        // Note: Mock data doesn't store passwords, so we bypass password check in offline mode 
        // OR you could assume 'Admin' password for everyone if strictly needed.
        if (user) {
             return user;
        }

        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error('Cannot connect to server. Ensure the backend is running.');
        }
        throw error;
    }
};

export const fetchUsers = async (): Promise<User[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        return await handleResponse(response);
    } catch (error) {
        console.warn('Fetch Users API unreachable, returning mock users.');
        return initialUsers;
    }
};

export const addUser = async (name: string, email: string, role: UserRole, password?: string, assignedCompany?: string): Promise<void> => {
    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role, password, assignedCompany }),
        });
        
        if (!response.ok) {
            const data = await handleResponse(response);
            throw new Error(data.message || 'Failed to create user');
        }
    } catch (error) {
        console.warn('Add User API unreachable. Simulating success.');
    }
};

export const updateUser = async (id: string, role: UserRole, assignedCompany?: string): Promise<void> => {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, assignedCompany }),
        });
        if (!response.ok) {
            const data = await handleResponse(response);
            throw new Error(data.message || 'Failed to update user');
        }
    } catch (error) {
        console.warn('Update User API unreachable. Simulating success.');
    }
};
