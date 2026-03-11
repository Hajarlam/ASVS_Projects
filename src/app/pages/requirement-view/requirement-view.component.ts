import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AsvsService } from '../../services/asvs.service';
import { AiService } from '../../services/ai.service';
import { AiDrawerService } from '../../services/ai-drawer.service';
import { AsvsRequirement, RequirementStatus } from '../../models/asvs.models';

@Component({
  selector: 'app-requirement-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './requirement-view.component.html',
  styleUrls: ['./requirement-view.component.css']
})
export class RequirementViewComponent implements OnInit {
  requirement: AsvsRequirement | null = null;
  notes = '';
  evidence = '';
  loading = true;
  error = '';
  noteSaved = false;
  evidenceSaved = false;

  aiLoading = false;
  aiResponse = '';
  aiError = '';

  private isBrowser: boolean;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private asvsService: AsvsService,
    private aiService: AiService,
    private aiDrawer: AiDrawerService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadRequirement(id);
  }

  loadRequirement(id: string) {
    this.loading = true;
    this.asvsService.getRequirementById(id).subscribe({
      next: (req) => {
        this.requirement = req;
        if (req) {
          this.notes = req.comment || '';
          this.evidence = req.evidence || '';
          this.saveRecent(id);
        }
        this.loading = false;
      },
      error: () => { this.error = 'Error loading requirement'; this.loading = false; }
    });
  }

  saveRecent(id: string) {
    if (!this.isBrowser) return;
    const recent: string[] = JSON.parse(localStorage.getItem('asvs_recent') || '[]');
    localStorage.setItem('asvs_recent', JSON.stringify([id, ...recent.filter(r => r !== id)].slice(0, 6)));
  }

  setStatus(status: RequirementStatus) {
    if (!this.requirement) return;
    const newStatus = this.requirement.status === status ? null : status;
    this.requirement.status = newStatus;
    this.requirement.valid = newStatus === 'pass';
    this.asvsService.setStatus(this.requirement.id, newStatus);
  }

  saveNote() {
    if (this.requirement && this.isBrowser) {
      this.asvsService.saveNote(this.requirement.id, this.notes);
      this.noteSaved = true;
      setTimeout(() => { this.noteSaved = false; this.cdr.detectChanges(); }, 2000);
    }
  }

  saveEvidence() {
    if (this.requirement && this.isBrowser) {
      this.asvsService.saveEvidence(this.requirement.id, this.evidence);
      this.evidenceSaved = true;
      setTimeout(() => { this.evidenceSaved = false; this.cdr.detectChanges(); }, 2000);
    }
  }

  openAI() {
    if (!this.requirement) return;
    this.aiDrawer.open({
      requirementId: this.requirement.id,
      requirement: this.requirement.verificationRequirement,
      context: this.requirement.area
    });
  }

  goBack() { this.router.navigate(['/dashboard']); }
}
