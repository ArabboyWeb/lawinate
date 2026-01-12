# Lawinate.uz - Yuridik Kelajak Platformasi

Modern va professional yuridik ta'lim platformasi. Abituriyentlar va talabalar uchun yaratilgan.

## 📋 Sahifalar

### 1. **index.html** - Bosh sahifa (Homepage)
- Hero banner
- Platformaning asosiy imkoniyatlari
- Statistika bo'limi
- Modern glassmorphism dizayn
- Navigation barcha sahifalarga ulangan

### 2. **auth.html** - Kirish / Ro'yxatdan o'tish ⭐ YANGI
- **3 bosqichli ro'yxatdan o'tish:**
  - Bosqich 1: Email, parol, telefon
  - Bosqich 2: Universitet tanlash (15+ universitet)
  - Bosqich 3: Profil rasmi yuklash
- Login forma
- Email validatsiya
- Parol tasdiqlash
- LocalStorage'da saqlash
- Progress indicator
- Image preview funksiyasi

### 3. **dashboard.html** - Foydalanuvchi Dashboard ⭐ YANGI
- **Profil ma'lumotlari:**
  - Rasm, ism, email
  - Universitet va kurs
  - Shahar
- **Statistika:**
  - Ishlangan testlar
  - To'g'ri javoblar
  - Umumiy ball
  - Kunlik strike
- **Taxminiy reyting ko'rsatkichi**
- **Progress chart** (Chart.js)
- So'nggi testlar tarixi
- Tavsiya etiladigan testlar
- Auto-calculate rank based on performance

### 4. **reyting.html** - Live Reyting
- TOP 100 yuristlar reytingi
- Live yangilanuvchi ball tizimi
- Podium (1-2-3 o'rin) ko'rinishi
- Filtr va qidiruv funksiyalari
- Statistika kartochalari
- Dinamik JavaScript bilan ishlaydi
- Trend indicators (up/down/same)

### 5. **kutubxona.html** - Smart Kutubxona
- PDF kitoblar katalogi
- Qidiruv funksiyasi
- Kategoriyalar bo'yicha filtrlash
- Kitoblarni ko'rish va yuklab olish
- Mashhur kitoblar bo'limi
- Interaktiv kitob kartochalari
- Download counter

### 6. **testlar.html** - Test Platformasi
- 6 xil test kategoriyasi:
  - Konstitutsiya
  - Jinoyat Huquqi
  - Fuqarolik Huquqi
  - DTM Tayyorgarlik
  - Mehnat Huquqi
  - Aralash Test
- **Interaktiv test modal oynasi**
- **Timer funksiyasi** (real-time countdown)
- **Progress bar**
- Natijalar jadvali
- Qiyinlik darajasi ko'rsatkichlari
- **Test natijasi reyting va dashboardga qo'shiladi**

### 7. **community.html** - Jamiyat (Forum)
- Forum mavzulari
- Muhokama platformasi
- Yangi post yaratish modal oynasi
- TOP contributors
- Mashhur teglar
- Kategoriyalar bo'yicha filtrlash
- Jamiyat qoidalari
- Pagination

### 8. **admin.html** - Admin Panel ⭐ YANGI
- **Dashboard Overview:**
  - Umumiy statistika
  - Foydalanuvchilar soni
  - Bugungi testlar
  - So'nggi faoliyat
- **Test boshqaruvi:**
  - Yangi test qo'shish
  - Savollar yaratish (dinamik)
  - Test kategoriyalari
  - Qiyinlik darajasi
  - Timer sozlamalari
- **Foydalanuvchilar:**
  - Barcha userlar ro'yxati
  - Qidiruv va filter
  - Edit/Delete funksiyalari
- **Analitika:**
  - Mashhur testlar
  - Faol universitetlar
  - Statistik ma'lumotlar
- **Sozlamalar:**
  - Sayt sozlamalari
  - Email konfiguratsiya
  - Ruxsatlar

## 🎨 Dizayn Xususiyatlari

- **Ranglar:**
  - Primary: `#0066FF` (lawBlue)
  - Dark: `#050505` (lawDark)
  - Card: `#0F1115` (lawCard)

- **Effektlar:**
  - Glassmorphism cards
  - Smooth transitions
  - Hover animations
  - Gradient backgrounds
  - Blur effects

- **Typography:**
  - Font: Inter (Google Fonts)
  - Weights: 300, 400, 600, 700, 900

## 🛠 Texnologiyalar

- **HTML5** - Semantic markup
- **TailwindCSS** - Utility-first CSS framework (CDN)
- **Phosphor Icons** - Modern icon library
- **JavaScript** - Interaktiv funksiyalar
- **Google Fonts** - Inter font family

## 📱 Responsive Design

Barcha sahifalar to'liq responsive:
- Desktop (lg: 1024px+)
- Tablet (md: 768px+)
- Mobile (sm: 640px-)

Mobile uchun alohida hamburger menu qo'shilgan.

## 🚀 GitHub Pages'ga Deploy Qilish

### 1-qadam: Repository yaratish
```bash
git init
git add .
git commit -m "Initial commit: Lawinate.uz platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/lawinate-uz.git
git push -u origin main
```

### 2-qadam: GitHub Pages yoqish
1. GitHub repository'ga kiring
2. `Settings` → `Pages`
3. Source: `Deploy from a branch`
4. Branch: `main` → folder: `/ (root)`
5. Save

### 3-qadam: Saytni ko'rish
5-10 daqiqadan keyin saytingiz tayyor:
```
https://YOUR-USERNAME.github.io/lawinate-uz/
```

## 📁 Fayl Strukturasi

```
lawinate-uz/
├── index.html          # Bosh sahifa
├── auth.html           # ⭐ Kirish / Ro'yxatdan o'tish
├── dashboard.html      # ⭐ Foydalanuvchi dashboard
├── reyting.html        # Reyting sahifasi
├── kutubxona.html      # Kutubxona sahifasi
├── testlar.html        # Testlar sahifasi
├── community.html      # Community sahifasi
├── admin.html          # ⭐ Admin panel
└── README.md           # Hujjat
```

⭐ = Yangi qo'shilgan sahifalar

## ✨ Asosiy Funksiyalar

### Authentication (auth.html) ⭐
- ✅ Multi-step registration (3 bosqich)
- ✅ Email validation
- ✅ Password confirmation
- ✅ 15+ O'zbekiston universitetlari
- ✅ Profil rasmi yuklash va preview
- ✅ LocalStorage integration
- ✅ Login form
- ✅ Auto-redirect if logged in

### Dashboard (dashboard.html) ⭐
- ✅ User profile display
- ✅ Statistics cards (tests, accuracy, points)
- ✅ **Taxminiy reyting** calculator
- ✅ Progress chart (Chart.js)
- ✅ Test history
- ✅ Recommendations
- ✅ Streak counter
- ✅ Protected route (redirect if not logged in)

### Admin Panel (admin.html) ⭐
- ✅ Dashboard overview
- ✅ Add new tests (dynamic questions)
- ✅ Manage users
- ✅ Analytics & statistics
- ✅ Settings management
- ✅ Test CRUD operations
- ✅ LocalStorage test management

### Reyting (reyting.html)
- ✅ Live reyting ko'rsatkichlari
- ✅ TOP 3 podium
- ✅ Dinamik jadval
- ✅ Filtr va qidiruv
- ✅ "Ko'proq yuklash" tugmasi
- ✅ Trend indicators

### Kutubxona (kutubxona.html)
- ✅ Qidiruv
- ✅ Kategoriya filtri
- ✅ Kitob katalogi
- ✅ Yuklab olish tugmalari
- ✅ Statistika
- ✅ Download counter

### Testlar (testlar.html)
- ✅ 6 ta test kategoriyasi
- ✅ Modal test oynasi
- ✅ Timer (45 daqiqa)
- ✅ Progress bar
- ✅ Natijalar tarixi
- ✅ Javob tanlash funksiyasi
- ✅ **Natijalar dashboard'ga yoziladi**
- ✅ **Reyting avtomatik yangilanadi**

### Community (community.html)
- ✅ Forum mavzulari
- ✅ Yangi post yaratish
- ✅ Filtr (Yangi, Mashhur, Javobsiz)
- ✅ TOP contributors
- ✅ Teglar tizimi
- ✅ Pagination

## 🎯 Kelajak Rivojlanish

- [ ] Backend integration (Node.js/Python)
- [ ] Database (MongoDB/PostgreSQL)
- [ ] User authentication
- [ ] Real PDF upload/download
- [ ] Live chat
- [ ] Video darslar bo'limi
- [ ] Payment integration
- [ ] Mobile App (React Native)

## 🔐 Authentication Flow (LocalStorage)

### Foydalanuvchi uchun:
1. **auth.html** - Ro'yxatdan o'tish (3 bosqich)
2. Ma'lumotlar **localStorage**'da saqlanadi
3. **dashboard.html** - Shaxsiy kabinet
4. **testlar.html** - Testlarni boshlash
5. Test natijalari **localStorage**'ga yoziladi
6. **Taxminiy reyting** avtomatik hisoblanadi:
   - Formula: `(testlar_soni * 10) + (to'g'ri_foizi * 5) + (ball / 10)`
   - Natija: #1 dan #5247 gacha

### Admin uchun:
1. **admin.html** - Admin panel
2. Test qo'shish forma
3. **localStorage** `lawinateTests` key'ida saqlash
4. Foydalanuvchilar boshqaruvi
5. Analitika va statistika

### Ma'lumotlar strukturasi:

```javascript
// User data (localStorage: lawinateUser)
{
  fullName: "Aziza Rahimova",
  email: "aziza@example.com",
  phone: "+998901234567",
  password: "hashed_password",
  university: "tdyu",
  course: "3",
  city: "toshkent",
  profileImage: "base64_image",
  bio: "Bio text...",
  totalTests: 45,
  correctAnswers: 1215,
  points: 2956,
  estimatedRank: 1,
  streakDays: 15,
  testHistory: [
    {
      name: "Konstitutsiya",
      date: "12.01.2025",
      correct: 27,
      total: 30,
      score: 90,
      points: 100
    }
  ]
}

// Tests data (localStorage: lawinateTests)
[
  {
    name: "Konstitutsiya testi",
    category: "Konstitutsiya",
    difficulty: "O'rta",
    questions: 30,
    duration: 45,
    description: "Test tavsifi...",
    createdAt: "2025-01-12T...",
    questions: [
      {
        question: "Savol matni...",
        options: ["A", "B", "C", "D"],
        correct: "A"
      }
    ]
  }
]
```

## 📞 Aloqa

- Website: lawinate.uz
- Telegram: @lawinate
- Instagram: @lawinate.uz

## 📄 Litsenziya

© 2025 Lawinate. Barcha huquqlar himoyalangan.

---

**Eslatma:** Bu static website versiyasi. GitHub Pages'da ishlash uchun backend funksiyalari kerak bo'lgan qismlar hozircha simulation qilingan.
