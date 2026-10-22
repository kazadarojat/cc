# Abstrak — CogniCare

**Judul:** CogniCare: Platform Pemantauan Kognitif Longitudinal Multimodal Berbasis Web untuk Deteksi Dini dan Pendukung Keputusan Klinis pada Penyakit Alzheimer

## Abstrak (Bahasa Indonesia)

Penyakit Alzheimer berkembang diam-diam selama satu hingga dua dekade sebelum gejala klinis muncul, sehingga penegakan diagnosis sering terlambat pada tahap demensia ketika intervensi sudah kurang efektif. Skrining konvensional seperti MoCA dan MMSE bersifat episodik, bergantung pada satu kali pengukuran, dan tidak menangkap perubahan halus yang berlangsung antarkunjungan. CogniCare dikembangkan sebagai prototipe platform berbasis web yang memadukan biomarker digital pasien—sampel tutur, kualitas tidur, kinerja tugas kognitif terkomputerisasi, kuesioner, dan diari kognitif—dengan data klinis, biologis, dan pencitraan yang dimasukkan klinisi, lalu mengubahnya menjadi pemantauan longitudinal yang berkelanjutan.

Sistem dibangun dengan Next.js 15, React 19, TypeScript, dan basis data relasional melalui Prisma, mencakup dua portal terpisah untuk klinisi dan pasien dengan alur persetujuan (consent) eksplisit. Mesin analisis multimodalnya bekerja dalam empat tahap: pembentukan baseline personal tiap pasien, penghitungan deviasi robust-z terhadap baseline tersebut, penggabungan berbobot (weighted late fusion) lintas modalitas, dan klasifikasi trajektori. Keluaran disajikan dalam tiga dimensi yang sengaja dipisahkan—status kognitif (Normal, SCD, MCI, Demensia beserta tingkat keyakinan), bukti biologis Alzheimer dalam kerangka AT(N), dan estimasi risiko progresi 12 bulan yang hanya ditampilkan bila kecukupan data terpenuhi. Sistem juga mendeteksi diskordansi multimodal, menampilkan atribusi kontribusi bergaya SHAP, serta menyusun ringkasan klinis otomatis.

Prototipe berhasil dijalankan secara fungsional dengan tiga profil pasien sintetis yang merepresentasikan pola progresif, penurunan subjektif dengan diskordansi, dan pemantauan preventif dengan data tidak memadai. CogniCare menunjukkan bahwa pemisahan status kognitif dari bukti biologis dan risiko progresi dapat menyajikan informasi yang lebih jujur dan dapat ditindaklanjuti bagi klinisi. Prototipe ini menggunakan data sintetis dan belum divalidasi secara klinis.

**Kata kunci:** Alzheimer; mild cognitive impairment; biomarker digital; pemantauan longitudinal; deteksi dini; sistem pendukung keputusan klinis

## Abstract (English)

Alzheimer's disease progresses silently for one to two decades before clinical symptoms emerge, so diagnosis is frequently delayed until the dementia stage, when intervention is least effective. Conventional screening instruments such as MoCA and MMSE are episodic, rely on a single measurement, and fail to capture subtle change between visits. CogniCare was developed as a web-based prototype that fuses patient-generated digital biomarkers—speech samples, sleep quality, computerised cognitive task performance, questionnaires, and a cognitive diary—with clinician-entered clinical, biological, and imaging data into continuous longitudinal monitoring.

The system is built with Next.js 15, React 19, TypeScript, and a Prisma-managed relational database, and provides two separate portals for clinicians and patients with an explicit consent flow. Its multimodal engine operates in four stages: construction of an individual personal baseline, robust-z deviation from that baseline, weighted late fusion across modalities, and trajectory classification. Outputs are deliberately separated into three dimensions—cognitive state (Normal, SCD, MCI, Dementia with confidence), biological Alzheimer evidence in an AT(N) framework, and a 12-month progression risk shown only when data sufficiency is met. The system additionally detects multimodal discordance, presents SHAP-style contribution attribution, and generates an automated longitudinal clinical summary.

The prototype runs end to end with three synthetic patient profiles representing a progressive course, subjective decline with discordance, and preventive monitoring with insufficient data. CogniCare demonstrates that separating cognitive state from biological evidence and progression risk yields information that is more honest and more actionable for clinicians. The prototype uses synthetic data and has not been clinically validated.

**Keywords:** Alzheimer's disease; mild cognitive impairment; digital biomarkers; longitudinal monitoring; early detection; clinical decision support
