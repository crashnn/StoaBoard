// ErrorBoundary — bir görünümün render sırasında fırlattığı hatayı yakalar.
//
// Neden var: React'te bir bileşen render'da hata fırlatırsa ve üstünde bir
// boundary yoksa, TÜM ağaç unmount olur — ekran komple siyah kalır. 2 Eylül'de
// Raporlar'daki bir kapsam hatası (lang is not defined) tam bunu yaptı; sidebar
// dahil her şey gitti. Boundary, hatayı tek bölümde tutar; gerisi ayakta kalır.
//
// Kullanım: görünüm alanını sarar ve key={view} verilir. key değişince
// (başka görünüme geçince) React boundary'yi yeniden kurar ve hata durumu
// kendiliğinden temizlenir — "başka ekrana geçince kurtuluyor" davranışı artık
// tasarımın parçası. Ayrıca "Yeniden dene" aynı görünümde sıfırlar.
//
// Error boundary yalnızca sınıf bileşeniyle yazılabilir (getDerivedStateFromError
// / componentDidCatch kancaları henüz fonksiyon bileşeninde yok).

import React from 'react';
import { Icon } from './icons.jsx';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Şimdilik konsola; ileride bir /api/client-error ucuna raporlanabilir.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const t = (k, fb) => window.t?.(k) || fb;
      return (
        <div className="error-boundary">
          <Icon name="alertTriangle" size={40} strokeWidth={1.5} />
          <div className="error-boundary-title">
            {t('err_view_crashed', 'Bir şeyler ters gitti')}
          </div>
          <div className="error-boundary-sub">
            {t(
              'err_view_crashed_sub',
              'Bu bölüm yüklenirken bir hata oluştu. Yeniden deneyebilir ya da soldan başka bir bölüme geçebilirsiniz.',
            )}
          </div>
          <button className="btn btn-primary" onClick={this.reset}>
            <Icon name="refresh" size={14} /> {t('err_retry', 'Yeniden dene')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
