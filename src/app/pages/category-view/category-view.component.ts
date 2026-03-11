import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AsvsService } from '../../services/asvs.service';
import { AsvsRequirement, AsvsCategory, RequirementStatus } from '../../models/asvs.models';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { AiDrawerService } from '../../services/ai-drawer.service';

@Component({
  selector: 'app-category-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: './category-view.component.html',
  styleUrls: ['./category-view.component.css']
})
export class CategoryViewComponent implements OnInit {
  category: AsvsCategory | null = null;
  requirements: AsvsRequirement[] = [];
  filteredRequirements: AsvsRequirement[] = [];
  pagedRequirements: AsvsRequirement[] = [];
  loading = true;

  levelFilter = 'all';
  statusFilter = 'all';
  searchTerm = '';

  passCount = 0;
  failCount = 0;
  naCount = 0;
  notTestedCount = 0;

  currentPage = 1;
  pageSize = 10;
  pageSizes = [5, 10, 20, 50];

  get totalPages(): number { return Math.ceil(this.filteredRequirements.length / this.pageSize); }

  get pages(): number[] {
    const total = this.totalPages, current = this.currentPage, pages: number[] = [];
    if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i); }
    else {
      pages.push(1);
      if (current > 3) pages.push(-1);
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
      if (current < total - 2) pages.push(-1);
      pages.push(total);
    }
    return pages;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private asvsService: AsvsService,
    private aiDrawer: AiDrawerService
  ) { }

  ngOnInit() {
    const key = this.route.snapshot.paramMap.get('key');
    if (key) this.loadCategory(key);
  }

  loadCategory(key: string) {
    this.category = this.asvsService.categories.find(c => c.key === key) || null;
    this.asvsService.getCategoryRequirements(key).subscribe({
      next: (reqs) => {
        this.requirements = reqs;
        this.applyFilters();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilters() {
    this.filteredRequirements = this.requirements.filter(req => {
      if (this.levelFilter !== 'all' && req.asvsLevel !== parseInt(this.levelFilter)) return false;
      if (this.statusFilter !== 'all' && req.status !== (this.statusFilter === 'none' ? null : this.statusFilter)) return false;
      if (this.searchTerm) {
        const t = this.searchTerm.toLowerCase();
        return req.verificationRequirement.toLowerCase().includes(t) ||
          req.id.toLowerCase().includes(t) || req.area.toLowerCase().includes(t);
      }
      return true;
    });
    this.recalcCounts();
    this.currentPage = 1;
    this.updatePage();
  }

  recalcCounts() {
    this.passCount = this.filteredRequirements.filter(r => r.status === 'pass').length;
    this.failCount = this.filteredRequirements.filter(r => r.status === 'fail').length;
    this.naCount = this.filteredRequirements.filter(r => r.status === 'na').length;
    this.notTestedCount = this.filteredRequirements.filter(r => !r.status).length;
  }

  updatePage() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedRequirements = this.filteredRequirements.slice(start, start + this.pageSize);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePage();
  }

  onPageSizeChange() { this.currentPage = 1; this.updatePage(); }

  setStatus(req: AsvsRequirement, status: RequirementStatus, event: Event) {
    event.stopPropagation();
    const newStatus = req.status === status ? null : status;
    req.status = newStatus;
    req.valid = newStatus === 'pass';
    this.asvsService.setStatus(req.id, newStatus);
    this.recalcCounts();
  }

  openAI(req: AsvsRequirement, event: Event) {
    event.stopPropagation();
    this.aiDrawer.open({
      requirementId: req.id,
      requirement: req.verificationRequirement,
      context: req.area
    });
  }

  goToRequirement(id: string) { this.router.navigate(['/requirement', id]); }
  goBack() { this.router.navigate(['/dashboard']); }

  exportChecklist() {
    if (this.filteredRequirements.length === 0) return;

    const headers = ['ID', 'Niveau', 'Domaine', 'Statut', 'Exigence', 'CWE', 'NIST'];
    const rows = this.filteredRequirements.map(req => [
      req.id,
      req.asvsLevel.toString(),
      `"${req.area.replace(/"/g, '""')}"`,
      req.status === 'pass' ? 'Reussi' : req.status === 'fail' ? 'Echoue' : req.status === 'na' ? 'N/A' : 'Non teste',
      `"${req.verificationRequirement.replace(/"/g, '""')}"`,
      req.cwe ? `CWE-${req.cwe}` : '',
      req.nist || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const catName = this.category ? this.category.name.replace(/\s+/g, '_') : 'ASVS';
    link.download = `Checklist_${catName}_Requirements.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
