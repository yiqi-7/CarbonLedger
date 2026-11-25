export type PageId = 'overview' | 'materials' | 'project' | 'projects' | 'login'
export type StyleId = 'ibm' | 'sap' | 'notion' | 'stripe'
export interface Material { id: number; name: string; type: string; quantity: number; unit: string; factor: number; price: number }
