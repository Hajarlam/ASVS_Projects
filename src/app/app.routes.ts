import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CategoryViewComponent } from './pages/category-view/category-view.component';
import { RequirementViewComponent } from './pages/requirement-view/requirement-view.component';
import { SearchResultsComponent } from './pages/search-results/search-results.component';
import { AboutComponent } from './pages/about/about.component';
import { AiChatComponent } from './pages/ai-chat/ai-chat.component';
import { LoginComponent } from './pages/login/login';
import { AdminComponent } from './pages/admin/admin.component';
import { SecurityComponent } from './pages/security/security.component';
import { HomeComponent } from './pages/home/home';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'security', component: SecurityComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: 'category/:key', component: CategoryViewComponent, canActivate: [authGuard] },
  { path: 'requirement/:id', component: RequirementViewComponent, canActivate: [authGuard] },
  { path: 'search', component: SearchResultsComponent, canActivate: [authGuard] },
  { path: 'about', component: AboutComponent, canActivate: [authGuard] },
  { path: 'chat', component: AiChatComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
