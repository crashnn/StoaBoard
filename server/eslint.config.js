// ESLint — sunucu. İki kural; gerekçe client/eslint.config.js başında.
//
// Sunucuda kanca kuralı yok (React yok), geriye çalışmayı bozan tek sınıf
// kalıyor: tanımsız değişken. `no-undef` hata, `no-unused-vars` da hata
// (18 Eylül 2026, kart #153: dokuz bulgu temizlendi, kural yükseltildi).
// Biçim kuralı bilerek yok.
import globals from 'globals';

export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['src/**/*.js', 'scripts/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
    },
  },
];
