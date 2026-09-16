// ESLint — ön yüz. Dört kural, hepsi bir canlı hataya karşılık geliyor.
//
// NİÇİN VAR: 15 Eylül 2026'da iki değişiklik 500 testten ve temiz bir
// derlemeden geçip canlıda patladı. Biri kanca sırasıydı (blok düzenleyicinin
// `useRef`i çekmecenin erken dönüşünün altına konmuştu, 9843983), öteki alt
// bileşende tanımsız bir değişkendi (`project`, 5af4e75). İkisi de kod
// okumasında kaçtı, çünkü sebep yüz satır yukarıdaydı. Bu sınıfı test ve
// derleme değil, yalnızca lint yakalar. Kural merdiveni: belge → test → lint.
//
// İki kural HATA (kanca push'u durdurur), iki kural UYARI (görünür, durdurmaz):
//   no-undef                   hata   — tanımsız değişken (5af4e75)
//   react-hooks/rules-of-hooks hata   — koşullu/erken dönüşten sonra kanca (9843983)
//   no-unused-vars             uyarı  — ölü ağırlık; mevcut kodda bulgu var, temizlenince hataya çekilir
//   react-hooks/exhaustive-deps uyarı — eksik bağımlılık; her bulgu gerçek hata değil
//
// Başka kural bilerek yok. Biçim kuralları (noktalı virgül, tırnak) bu deponun
// derdi değil; kurala uymayan kod çalışıyor. Buradaki dördü uymayan kod çalışmıyor.
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['node_modules/**', '../static/dist/**', 'dist/**'] },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        // Uygulama genelinde `window`a asılıp çıplak okunanlar. `global.test.js`
        // bunların gerçekten atandığını ayrıca doğruluyor; burada yalnızca
        // "tanımsız değil" deniyor. Yeni bir global eklerken oraya da bak.
        DATA: 'readonly',
        API: 'readonly',
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // js.configs.recommended'ın tamamı değil: yalnızca çalışmayı bozanlar.
      'no-undef': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'no-unused-vars': ['warn', {
        // Bilerek kullanılmayan argüman/değişken alt çizgiyle işaretlenir.
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Vite yapılandırması tarayıcıda değil Node'da koşuyor; `__dirname`i Vite
  // kendisi sağlıyor. Tarayıcı globalleriyle taranırsa sahte hata verir.
  {
    files: ['vite.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'warn' },
  },
];
