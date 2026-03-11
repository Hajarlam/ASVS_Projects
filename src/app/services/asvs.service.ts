import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AsvsRequirement, AsvsCategory, CategoryStats, RequirementStatus } from '../models/asvs.models';

import asvsData from '../../assets/asvs-data.json';

@Injectable({
  providedIn: 'root'
})
export class AsvsService {

  categories: AsvsCategory[] = [
    { key: 'architecture', name: 'Architecture', icon: '🏗️', color: '#4A90E2', description: 'Security architecture and design', requirements: [], count: 0 },
    { key: 'authentication', name: 'Authentication', icon: '🔐', color: '#E83E8C', description: 'User authentication and credential management', requirements: [], count: 0 },
    { key: 'sessionManagement', name: 'Session Management', icon: '🍪', color: '#F5A623', description: 'Session handling and token management', requirements: [], count: 0 },
    { key: 'accessControl', name: 'Access Control', icon: '🚪', color: '#D0021B', description: 'Authorization and permission controls', requirements: [], count: 0 },
    { key: 'inputValidation', name: 'Input Validation', icon: '📝', color: '#9013FE', description: 'Input validation and sanitization', requirements: [], count: 0 },
    { key: 'cryptographyAtRest', name: 'Cryptography', icon: '🔑', color: '#417505', description: 'Data encryption and key management', requirements: [], count: 0 },
    { key: 'errorHandlingAndLogging', name: 'Error Handling & Logging', icon: '⚠️', color: '#BD10E0', description: 'Error handling and security logging', requirements: [], count: 0 },
    { key: 'dataProtection', name: 'Data Protection', icon: '🛡️', color: '#C8A400', description: 'Sensitive data protection', requirements: [], count: 0 },
    { key: 'communicationSecurity', name: 'Communication Security', icon: '📡', color: '#2DAA4F', description: 'Secure communications', requirements: [], count: 0 },
    { key: 'maliciousCode', name: 'Malicious Code', icon: '🦠', color: '#7B5EA7', description: 'Protection against malicious code', requirements: [], count: 0 },
    { key: 'businessLogic', name: 'Business Logic', icon: '⚙️', color: '#4A4A4A', description: 'Business logic security', requirements: [], count: 0 },
    { key: 'filesAndResources', name: 'Files & Resources', icon: '📁', color: '#8B572A', description: 'File upload and resource handling', requirements: [], count: 0 },
    { key: 'apiAndWebService', name: 'API & Web Services', icon: '🌐', color: '#F7921E', description: 'API security', requirements: [], count: 0 },
    { key: 'configuration', name: 'Configuration', icon: '🔧', color: '#6A1B9A', description: 'Security configuration', requirements: [], count: 0 }
  ];

  private userNotes: Map<string, string> = new Map();
  private userEvidence: Map<string, string> = new Map();
  private requirementStatuses: Map<string, RequirementStatus> = new Map();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loadUserData();
  }

  private loadUserData() {
    if (this.isBrowser) {
      try {
        const savedNotes = localStorage.getItem('asvs_notes');
        if (savedNotes) this.userNotes = new Map(Object.entries(JSON.parse(savedNotes)));

        const savedEvidence = localStorage.getItem('asvs_evidence');
        if (savedEvidence) this.userEvidence = new Map(Object.entries(JSON.parse(savedEvidence)));

        const savedStatuses = localStorage.getItem('asvs_statuses');
        if (savedStatuses) this.requirementStatuses = new Map(Object.entries(JSON.parse(savedStatuses)));
      } catch (e) {
        console.warn('Could not load user data from localStorage');
      }
    }
  }

  private saveUserData() {
    if (this.isBrowser) {
      try {
        localStorage.setItem('asvs_notes', JSON.stringify(Object.fromEntries(this.userNotes)));
        localStorage.setItem('asvs_evidence', JSON.stringify(Object.fromEntries(this.userEvidence)));
        localStorage.setItem('asvs_statuses', JSON.stringify(Object.fromEntries(this.requirementStatuses)));
      } catch (e) { }
    }
  }

  getDataSync(): any {
    return asvsData as any;
  }

  private enrichRequirement(req: AsvsRequirement): AsvsRequirement {
    const status = this.requirementStatuses.get(req.id) ?? null;
    return {
      ...req,
      comment: this.userNotes.get(req.id) || '',
      evidence: this.userEvidence.get(req.id) || '',
      status,
      valid: status === 'pass'
    };
  }

  getAllData(): Observable<any> {
    return of(this.getDataSync());
  }

  getCategoryRequirements(categoryKey: string): Observable<AsvsRequirement[]> {
    const data = this.getDataSync();
    const reqs: AsvsRequirement[] = (data[categoryKey] || []).map((req: AsvsRequirement) => this.enrichRequirement(req));
    return of(reqs);
  }

  getAllRequirements(): Observable<AsvsRequirement[]> {
    const data = this.getDataSync();
    let all: AsvsRequirement[] = [];
    for (const category in data) {
      if (Array.isArray(data[category])) {
        all = [...all, ...data[category].map((req: AsvsRequirement) => this.enrichRequirement(req))];
      }
    }
    return of(all);
  }

  getRequirementById(id: string): Observable<AsvsRequirement | null> {
    return this.getAllRequirements().pipe(
      map(requirements => requirements.find(r => r.id === id) || null)
    );
  }

  searchRequirements(searchTerm: string): Observable<AsvsRequirement[]> {
    return this.getAllRequirements().pipe(
      map(requirements => {
        const term = searchTerm.toLowerCase();
        return requirements.filter(req =>
          req.verificationRequirement.toLowerCase().includes(term) ||
          req.area.toLowerCase().includes(term) ||
          req.id.toLowerCase().includes(term)
        );
      })
    );
  }

  getStats(): Observable<CategoryStats> {
    return this.getAllRequirements().pipe(
      map(requirements => ({
        total: requirements.length,
        level1: requirements.filter(r => r.asvsLevel === 1).length,
        level2: requirements.filter(r => r.asvsLevel === 2).length,
        level3: requirements.filter(r => r.asvsLevel === 3).length,
        passed: requirements.filter(r => r.status === 'pass').length,
        failed: requirements.filter(r => r.status === 'fail').length,
        na: requirements.filter(r => r.status === 'na').length,
        notTested: requirements.filter(r => !r.status).length
      }))
    );
  }

  getCategoryCounts(): Observable<Map<string, number>> {
    const data = this.getDataSync();
    const counts = new Map<string, number>();
    for (const category in data) {
      if (Array.isArray(data[category])) counts.set(category, data[category].length);
    }
    return of(counts);
  }

  getCategoryStatusCounts(): Observable<Map<string, { pass: number; fail: number; na: number }>> {
    return this.getAllRequirements().pipe(
      map(reqs => {
        const result = new Map<string, { pass: number; fail: number; na: number }>();
        const data = this.getDataSync();
        for (const cat of this.categories) {
          const catIds = new Set((data[cat.key] || []).map((r: any) => r.id));
          const catReqs = reqs.filter(r => catIds.has(r.id));
          result.set(cat.key, {
            pass: catReqs.filter(r => r.status === 'pass').length,
            fail: catReqs.filter(r => r.status === 'fail').length,
            na: catReqs.filter(r => r.status === 'na').length
          });
        }
        return result;
      })
    );
  }

  setStatus(requirementId: string, status: RequirementStatus) {
    if (status === null) {
      this.requirementStatuses.delete(requirementId);
    } else {
      this.requirementStatuses.set(requirementId, status);
    }
    this.saveUserData();
  }

  getStatus(requirementId: string): RequirementStatus {
    return this.requirementStatuses.get(requirementId) ?? null;
  }

  saveNote(requirementId: string, note: string) {
    this.userNotes.set(requirementId, note);
    this.saveUserData();
  }

  saveEvidence(requirementId: string, evidence: string) {
    this.userEvidence.set(requirementId, evidence);
    this.saveUserData();
  }

  // Legacy compat
  toggleComplete(requirementId: string) {
    const current = this.requirementStatuses.get(requirementId);
    if (current === 'pass') {
      this.requirementStatuses.delete(requirementId);
    } else {
      this.requirementStatuses.set(requirementId, 'pass');
    }
    this.saveUserData();
  }

  isCompleted(requirementId: string): boolean {
    return this.requirementStatuses.get(requirementId) === 'pass';
  }
}
