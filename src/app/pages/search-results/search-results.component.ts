import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AsvsService } from '../../services/asvs.service';
import { AsvsRequirement } from '../../models/asvs.models';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.css']
})
export class SearchResultsComponent implements OnInit {
  searchTerm = '';
  statusFilter = '';
  results: AsvsRequirement[] = [];
  pagedResults: AsvsRequirement[] = [];
  loading = true;

  currentPage = 1;
  pageSize = 10;
  pageSizes = [5, 10, 20, 50];

  get pageTitle(): string {
    if (this.statusFilter === 'pass') return '✅ Exigences Réussies';
    if (this.statusFilter === 'fail') return '❌ Exigences Échouées';
    if (this.statusFilter === 'na') return '➖ Exigences N/A';
    return `Résultats pour "${this.searchTerm}"`;
  }

  get totalPages(): number { return Math.ceil(this.results.length / this.pageSize); }

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

  constructor(private route: ActivatedRoute, private router: Router, private asvsService: AsvsService) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.searchTerm = params['q'] || '';
      this.statusFilter = params['status'] || '';
      this.doSearch();
    });
  }

  doSearch() {
    this.loading = true;
    if (this.statusFilter) {
      this.asvsService.getAllRequirements().subscribe(all => {
        this.results = all.filter((r: AsvsRequirement) => {
          if (this.statusFilter === 'pass') return r.status === 'pass';
          if (this.statusFilter === 'fail') return r.status === 'fail';
          if (this.statusFilter === 'na') return r.status === 'na';
          return false;
        });
        this.loading = false;
        this.currentPage = 1;
        this.updatePage();
      });
    } else {
      this.asvsService.searchRequirements(this.searchTerm).subscribe(results => {
        this.results = results;
        this.loading = false;
        this.currentPage = 1;
        this.updatePage();
      });
    }
  }

  updatePage() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedResults = this.results.slice(start, start + this.pageSize);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePage();
  }

  onPageSizeChange() { this.currentPage = 1; this.updatePage(); }
  goToRequirement(id: string) { this.router.navigate(['/requirement', id]); }
  goBack() { this.router.navigate(['/dashboard']); }
}
