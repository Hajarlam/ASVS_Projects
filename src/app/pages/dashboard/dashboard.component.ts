import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AsvsService } from '../../services/asvs.service';
import { CategoryStats, AsvsCategory } from '../../models/asvs.models';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── i18n dictionary ──────────────────────────────────────────────────────────
const TRANSLATIONS: Record<string, Record<string, string>> = {
  fr: {
    'hero.eyebrow': 'Sécurité Applicative',
    'hero.title1': 'Standard de Vérification',
    'hero.title2': 'de Sécurité ASVS',
    'hero.subtitle': 'Suivez, vérifiez et testez vos exigences de sécurité applicative avec une assistance IA.',
    'hero.pdf': 'Rapport PDF',
    'hero.mcp': 'Scan GitHub MCP',
    'stats.total': 'Total',
    'stats.pass': 'Réussies',
    'stats.fail': 'Échouées',
    'stats.na': 'N/A',
    'stats.pending': 'Non testées',
    'progress.label': 'Progression globale',
    'sections.categories': 'Catégories de Sécurité',
    'sections.domains': 'domaines',
    'sections.recent': 'Consultés récemment',
  },
  en: {
    'hero.eyebrow': 'Application Security',
    'hero.title1': 'Application Security',
    'hero.title2': 'Verification Standard',
    'hero.subtitle': 'Track, verify and test your application security requirements with AI assistance.',
    'hero.pdf': 'PDF Report',
    'hero.mcp': 'GitHub MCP Scan',
    'stats.total': 'Total',
    'stats.pass': 'Passed',
    'stats.fail': 'Failed',
    'stats.na': 'N/A',
    'stats.pending': 'Untested',
    'progress.label': 'Global Progress',
    'sections.categories': 'Security Categories',
    'sections.domains': 'domains',
    'sections.recent': 'Recently Viewed',
  }
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  // ── Data ──────────────────────────────────────────────────────────────────
  categories: AsvsCategory[] = [];
  stats: CategoryStats | null = null;
  categoryCounts: Map<string, number> = new Map();
  categoryStatusCounts: Map<string, { pass: number; fail: number; na: number }> = new Map();
  recentRequirements: any[] = [];

  // ── Language ──────────────────────────────────────────────────────────────
  lang: 'fr' | 'en' = 'fr';

  constructor(
    private asvsService: AsvsService,
    public router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.categories = this.asvsService.categories;

    // Restore saved language preference
    if (isPlatformBrowser(platformId)) {
      const saved = localStorage.getItem('asvs_lang') as 'fr' | 'en' | null;
      if (saved === 'fr' || saved === 'en') this.lang = saved;
    }
  }

  ngOnInit() {
    this.asvsService.getStats().subscribe(s => this.stats = s);
    this.asvsService.getCategoryCounts().subscribe(c => this.categoryCounts = c);
    this.asvsService.getCategoryStatusCounts().subscribe(c => this.categoryStatusCounts = c);
    this.loadRecentRequirements();
  }

  // ── i18n ──────────────────────────────────────────────────────────────────
  /** Translate a key for the current language. */
  t(key: string): string {
    return TRANSLATIONS[this.lang]?.[key] ?? key;
  }

  setLang(l: 'fr' | 'en') {
    this.lang = l;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('asvs_lang', l);
    }
  }

  // ── Recent requirements ───────────────────────────────────────────────────
  loadRecentRequirements() {
    if (!isPlatformBrowser(this.platformId)) return;
    const recent: string[] = JSON.parse(localStorage.getItem('asvs_recent') || '[]');
    if (recent.length > 0) {
      this.asvsService.getAllRequirements().subscribe((reqs: any[]) => {
        this.recentRequirements = reqs
          .filter((r: any) => recent.includes(r.id))
          .slice(0, 6);
      });
    }
  }

  // ── Category helpers ──────────────────────────────────────────────────────
  getCategoryPassCount(key: string): number {
    return this.categoryStatusCounts.get(key)?.pass ?? 0;
  }

  getCategoryProgress(key: string): number {
    const total = this.categoryCounts.get(key) ?? 0;
    const done = this.getCategoryPassCount(key);
    return total > 0 ? (done / total) * 100 : 0;
  }

  getGlobalProgress(): number {
    if (!this.stats || this.stats.total === 0) return 0;
    return ((this.stats.passed + this.stats.na) / this.stats.total) * 100;
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  goToCategory(key: string) { this.router.navigate(['/category', key]); }
  goToRequirement(id: string) { this.router.navigate(['/requirement', id]); }

  // ── PDF Export ────────────────────────────────────────────────────────────
  async generatePDF() {
    if (!this.stats) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const isFr = this.lang === 'fr';

    const labels = {
      title: isFr ? 'Rapport d\'Audit ASVS de Sécurité' : 'ASVS Security Audit Report',
      genDate: isFr ? 'Date de génération :' : 'Generated on:',
      execSum: isFr ? 'Résumé Exécutif' : 'Executive Summary',
      score: isFr ? 'Score de Sécurité Global :' : 'Global Security Score:',
      passed: isFr ? 'Exigences Réussies :' : 'Passed Requirements:',
      failed: isFr ? 'Exigences Échouées :' : 'Failed Requirements:',
      untested: isFr ? 'Non Testées :' : 'Untested:',
      detail: isFr ? 'Détail par Domaine de Sécurité' : 'Detail by Security Domain',
      headers: isFr
        ? ['Domaine', 'Total', 'Réussi', 'Échec', 'N/A', 'Progression']
        : ['Domain', 'Total', 'Passed', 'Failed', 'N/A', 'Progress'],
    };

    // ── Header ──
    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.text(labels.title, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const dateStr = new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-GB');
    doc.text(`${labels.genDate} ${dateStr}`, pageWidth / 2, 28, { align: 'center' });

    // ── Summary ──
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(labels.execSum, 14, 44);

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const pct = this.getGlobalProgress().toFixed(1);
    doc.text(`${labels.score} ${pct}%`, 14, 54);
    doc.text(`${labels.passed} ${this.stats.passed} / ${this.stats.total}`, 14, 61);
    doc.text(`${labels.failed} ${this.stats.failed}`, 14, 68);
    doc.text(`${labels.untested} ${this.stats.notTested}`, 14, 75);

    // ── Table ──
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(labels.detail, 14, 90);

    const tableData = this.categories.map(cat => {
      const total = this.categoryCounts.get(cat.key) ?? 0;
      const statuses = this.categoryStatusCounts.get(cat.key) ?? { pass: 0, fail: 0, na: 0 };
      const catPct = total > 0 ? Math.round((statuses.pass / total) * 100) : 0;
      return [cat.name, `${total}`, `${statuses.pass}`, `${statuses.fail}`, `${statuses.na}`, `${catPct}%`];
    });

    autoTable(doc, {
      startY: 95,
      head: [labels.headers],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30] },
      styles: { fontSize: 9 }
    });

    doc.save(`ASVS_Report_${dateStr.replace(/\//g, '-')}.pdf`);
  }
}