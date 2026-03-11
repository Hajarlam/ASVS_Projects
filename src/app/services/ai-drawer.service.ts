import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DrawerRequest {
  requirementId: string;
  requirement: string;
  context: string;
}

@Injectable({ providedIn: 'root' })
export class AiDrawerService {
  private open$ = new BehaviorSubject<boolean>(false);
  private request$ = new BehaviorSubject<DrawerRequest | null>(null);
  private response$ = new BehaviorSubject<string>('');
  private loading$ = new BehaviorSubject<boolean>(false);

  isOpen$ = this.open$.asObservable();
  request = this.request$.asObservable();
  response = this.response$.asObservable();
  loading = this.loading$.asObservable();

  open(req: DrawerRequest) {
    this.request$.next(req);
    this.response$.next('');
    this.open$.next(true);
  }

  close() {
    this.open$.next(false);
  }

  setLoading(v: boolean) { this.loading$.next(v); }
  setResponse(v: string) { this.response$.next(v); }
  getRequest() { return this.request$.value; }
}
