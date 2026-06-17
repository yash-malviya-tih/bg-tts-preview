import { FeatureItem, LanguageDemo, VoicePreset } from './types';
import { Mic, Globe, Repeat, Zap, Layers, Languages } from 'lucide-react';

const envApiUrl = (import.meta as any).env?.VITE_TTS_API_URL as string | undefined;
const baseUrl = ((import.meta as any).env?.BASE_URL as string | undefined) || '/';
export const buildAppUrl = (assetPath: string) => `${baseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`;
export const API_URL = envApiUrl && envApiUrl.trim().length > 0 ? envApiUrl : buildAppUrl('/api/tts/synthesize/upload');

export const LOGO_URL = buildAppUrl('/bharatgen-logo.png');

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'hi',
    name: 'Hindi',
    audioUrl: '/api/tts/reference/hi',
    refText: 'बोली कैसे नमकहराम बैल हैं कि एक दिन भी वहाँ काम न किया।',
    languageId: 'hi'
  },
  {
    id: 'bn',
    name: 'Bengali',
    audioUrl: '/api/tts/reference/bn',
    refText: 'এটা খুবই উৎসাহজনক। আমরা মধুবনী চিত্রকলা নিয়েও কিছু জানতে চাই।',
    languageId: 'bn'
  },
  {
    id: 'ta',
    name: 'Tamil',
    audioUrl: '/api/tts/reference/ta',
    refText: 'திரும்பி ஓடிவந்து கொண்டிருந்த அவளை நாலே பாய்ச்சலில் பிடித்துவிடலாம் என்பதுதான் அவனுடைய உத்தேசம்.',
    languageId: 'ta'
  },
  {
    id: 'mr',
    name: 'Marathi',
    audioUrl: '/api/tts/reference/mr',
    refText: 'खांगखुईचे लेणे ही उखरुल जिल्ह्यातील चुनखडीची एक नैसर्गिक गुंफा आहे.',
    languageId: 'mr'
  },
  {
    id: 'en',
    name: 'Indian English',
    audioUrl: '/api/tts/reference/en',
    refText: 'Ask her to bring these things with her from the store.',
    languageId: 'en'
  }
];

export const FEATURES: FeatureItem[] = [
  {
    title: "Voice Cloning",
    description: "Clone a speaker's voice from a short audio sample while preserving natural tone and style.",
    icon: Mic
  },
  {
    title: "Polyglot Generation",
    description: "Generate speech across the full 22-language BharatGen model from one unified system.",
    icon: Globe
  },
  {
    title: "Cross-Language Transfer",
    description: "Use a voice sample in one language to generate speech in another language.",
    icon: Repeat
  },
  {
    title: "Blazing-Fast Speed",
    description: "Near-instant speech output designed for real-time applications.",
    icon: Zap
  },
  {
    title: "Code-Mixed Speech",
    description: "Handles mixed-script and mixed-language inputs using IPA and language-id normalization.",
    icon: Layers
  },
  {
    title: "22-Language Support",
    description: "Supports Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu, and Urdu.",
    icon: Languages
  }
];

export const LANGUAGE_DEMOS: LanguageDemo[] = [
  {
    id: 'as',
    name: 'Assamese',
    scriptLabel: 'অসমীয়া',
    demos: [
      {
        title: "Standard Assamese",
        display_text: "Responsible driving keeps everyone safe.",
        actual_text: "ৰাস্তাৰ ভুল দিশত গাড়ী চলোৱা শিক্ষিত লোকসকলৰ ওপৰত মোৰ বহুত খং উঠে।",
        type: "Normal"
      }
    ]
  },
  {
    id: 'bn',
    name: 'Bengali',
    scriptLabel: 'বাংলা',
    demos: [
      {
        title: "Standard Bengali",
        display_text: "We want to learn about Madhubani painting.",
        actual_text: "এটা খুবই উৎসাহজনক। আমরা মধুবনী চিত্রকলা নিয়েও কিছু জানতে চাই।",
        type: "Normal"
      }
    ]
  },
  {
    id: 'brx',
    name: 'Bodo',
    scriptLabel: 'बरʼ',
    demos: [
      {
        title: "Standard Bodo",
        display_text: "The hotel charged us differently than expected.",
        actual_text: "बे ह'टेलाव जोंनिफ्राय गुबुन-गुबुन बेसेन लानाय जादोंमोन, जायनि जाहोनाव जों जोंनि ह'टेलनि सइसखौ लाना दुखु जादोंमोन।",
        type: "Normal"
      }
    ]
  },
  {
    id: 'doi',
    name: 'Dogri',
    scriptLabel: 'डोगरी',
    demos: [
      {
        title: "Standard Dogri",
        display_text: "Can I use my app to log in to the portal?",
        actual_text: "क्या में अपने ऐम्मपिन दा इस्तेमाल करियै कोविन पोर्टल च लाग इन करी सकनीं ?",
        type: "Normal"
      }
    ]
  },
  {
    id: 'en',
    name: 'Indian English',
    scriptLabel: 'Indian English',
    demos: [
      {
        title: "Standard Indian English",
        display_text: "Ask her to bring these things with her from the store.",
        actual_text: "Ask her to bring these things with her from the store.",
        type: "Normal"
      },
      {
        title: "Product Vision",
        display_text: "Voice cloning that feels natural and fast.",
        actual_text: "Voice cloning that feels natural and fast.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'gu',
    name: 'Gujarati',
    scriptLabel: 'ગુજરાતી',
    demos: [
      {
        title: "Standard Gujarati",
        display_text: "I did not expect the bank to be open this Saturday.",
        actual_text: "મને આ શનિવારે બેંક ખુલ્લી રહેવાની અપેક્ષા નહોતી અને કર્મચારીઓને કામ કરતા જોઈને હું આશ્ચર્યચકિત થઈ ગયો હતો.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'hi',
    name: 'Hindi',
    scriptLabel: 'हिन्दी',
    demos: [
      {
        title: "Standard Hindi",
        display_text: "The oxen did not work there even for a day.",
        actual_text: "बोली कैसे नमकहराम बैल हैं कि एक दिन भी वहाँ काम न किया।",
        type: "Normal"
      },
      {
        title: "Code-Mixed Hindi",
        display_text: "India's diversity, AI's power.",
        actual_text: "भारत की diversity, AI की ताकत।",
        type: "Code-Mix"
      }
    ]
  },
  {
    id: 'kn',
    name: 'Kannada',
    scriptLabel: 'ಕನ್ನಡ',
    demos: [
      {
        title: "Standard Kannada",
        display_text: "Ancient Buddhist and Jain texts mention music.",
        actual_text: "ಸಾಮಾನ್ಯ ಯುಗದ ಆರಂಭಿಕ ಅವಧಿಯ ಬೌದ್ಧ ಮತ್ತು ಜೈನ ಪಠ್ಯಗಳಲ್ಲಿಯೂ ಸಂಗೀತದ ಉಲ್ಲೇಖವಿದೆ.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'ks',
    name: 'Kashmiri',
    scriptLabel: 'کٲشُر',
    demos: [
      {
        title: "Standard Kashmiri",
        display_text: "International Mother Language Day is observed every year.",
        actual_text: "بَین الاقوٲمی ماجہِ زؠو دۄہ چھُ اَکھ عالمی دۄہ یُس اکَوُہ فَرؤری، پرٛتھ ؤریہِ مَناونہٕ چُھ یِوان ۔",
        type: "Normal"
      }
    ]
  },
  {
    id: 'kok',
    name: 'Konkani',
    scriptLabel: 'कोंकणी',
    demos: [
      {
        title: "Standard Konkani",
        display_text: "There was no other newspaper like this for me.",
        actual_text: "म्हजे खातीर सुनापरान्त हैं निखटें हेर दिसाळ्यांवरी आनीक एक दिसाळें नाशिल्लें.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'mai',
    name: 'Maithili',
    scriptLabel: 'मैथिली',
    demos: [
      {
        title: "Standard Maithili",
        display_text: "Sweet Falls is a waterfall in Shillong.",
        actual_text: "शिलांगमे स्वीट फॉल्स नामक एकटा झरना छै, जकरा स्थानीय भाषामे क्षैद वेइटडेन सेहो कहल जाइत छै।",
        type: "Normal"
      }
    ]
  },
  {
    id: 'ml',
    name: 'Malayalam',
    scriptLabel: 'മലയാളം',
    demos: [
      {
        title: "Standard Malayalam",
        display_text: "Anees Bazmee's hit comedy followed Kapoor that year.",
        actual_text: "അനീസ് ബാസ്മിയുടെ സൂപ്പർഹിറ്റ് കോമഡി 'നോ എൻട്രി' ആ വർഷം കപൂറിനെ പിന്തുടർന്നു.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'mni',
    name: 'Manipuri',
    scriptLabel: 'ꯃꯩꯇꯩꯂꯣꯟ',
    demos: [
      {
        title: "Standard Manipuri",
        display_text: "Mirabai Chanu remains a major hope for the Indian team.",
        actual_text: "ꯍꯥꯟꯅꯒꯤ ꯋꯥꯔꯜ ꯆꯦꯝꯄꯤꯌꯟ ꯃꯤꯔꯥꯕꯥꯏ ꯆꯅꯨꯅ ꯚꯥꯔꯠ ꯇꯤꯝꯒꯤ ꯑꯆꯧꯕ ꯑꯁꯥ ꯑꯣꯏꯔꯤ ꯫",
        type: "Normal"
      }
    ]
  },
  {
    id: 'mr',
    name: 'Marathi',
    scriptLabel: 'मराठी',
    demos: [
      {
        title: "Standard Marathi",
        display_text: "Khangkhui Cave is a natural limestone cave.",
        actual_text: "खांगखुईचे लेणे ही उखरुल जिल्ह्यातील चुनखडीची एक नैसर्गिक गुंफा आहे.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'ne',
    name: 'Nepali',
    scriptLabel: 'नेपाली',
    demos: [
      {
        title: "Standard Nepali",
        display_text: "Try this when the road is clear and beautiful.",
        actual_text: "तपाईँले यो कोसिस गर्नुपर्छ, जब बाटो खाली अनि सुन्दर हुन्छ त्यति बेला शान्त महसुस हुन्छ।",
        type: "Normal"
      }
    ]
  },
  {
    id: 'or',
    name: 'Odia',
    scriptLabel: 'ଓଡ଼ିଆ',
    demos: [
      {
        title: "Standard Odia",
        display_text: "What should we do if the child refuses to report the problem?",
        actual_text: "ଯଦି ପିଲାଟି ସମସ୍ୟାଟିକୁ ରିପୋର୍ଟ କରିବାକୁ ନାରାଜ ତେବେ ଆମେ କ'ଣ କରିବା?",
        type: "Normal"
      }
    ]
  },
  {
    id: 'pa',
    name: 'Punjabi',
    scriptLabel: 'ਪੰਜਾਬੀ',
    demos: [
      {
        title: "Standard Punjabi",
        display_text: "A star of the silent era shone brightly.",
        actual_text: "ਫ਼ਿਲਮਾਂ  ਦਿਓ ਉਸ ਖਾਮੋਸ਼ ਯੁੱਗ ਦੀ ਡੋਲਵੋਰਸ ਕਾਸਟੈਲਵੋ ਇਕ ਜਗ-ਮਗਾਂਦੀ ਤਾਰਿਕਾ ਸੀ.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'sa',
    name: 'Sanskrit',
    scriptLabel: 'संस्कृतम्',
    demos: [
      {
        title: "Standard Sanskrit",
        display_text: "Kartik saw his strong wrestling opponent shaking.",
        actual_text: "कार्तिकः स्वस्य प्रबलं मल्लयुद्धप्रतिद्वन्द्विनम् कम्पनेन अपश्यत्।",
        type: "Normal"
      }
    ]
  },
  {
    id: 'sat',
    name: 'Santali',
    scriptLabel: 'ᱥᱟᱱᱛᱟᱲᱤ',
    demos: [
      {
        title: "Standard Santali",
        display_text: "A Santali sample sentence for the model.",
        actual_text: "ᱤᱧ ᱫᱚ ᱵᱷᱟᱲᱩᱢᱵᱷᱟᱜ ᱞᱤᱱᱟᱹᱧ ! ᱚᱱᱟ ᱫᱟᱱ ᱫᱚ ᱱᱚᱝᱠᱟᱱ ᱡᱟᱦᱟᱱᱟᱜ ᱫᱚ ᱵᱟᱝ ᱠᱟᱱᱟ ᱡᱟᱦᱟ ᱫᱚ ᱟᱵᱚ ᱚᱱᱟ ᱛᱟᱭᱚᱢ ᱛᱮᱵᱚᱱ ᱧᱟᱢ ᱫᱟᱲᱮᱭᱟᱜᱼᱟ ᱾",
        type: "Normal"
      }
    ]
  },
  {
    id: 'sd',
    name: 'Sindhi',
    scriptLabel: 'سنڌي',
    demos: [
      {
        title: "Standard Sindhi",
        display_text: "A Sindhi sample sentence for the model.",
        actual_text: "वाधूमल हिनजो न रुगो पुराणो दोस्तु हो पर हिन बाज़ार में अचण खां पोइ ई हिनजी किस्मत चोट चढ़ी हुई।",
        type: "Normal"
      }
    ]
  },
  {
    id: 'ta',
    name: 'Tamil',
    scriptLabel: 'தமிழ்',
    demos: [
      {
        title: "Standard Tamil",
        display_text: "He thought he could catch her in four strides.",
        actual_text: "திரும்பி ஓடிவந்து கொண்டிருந்த அவளை நாலே பாய்ச்சலில் பிடித்துவிடலாம் என்பதுதான் அவனுடைய உத்தேசம்.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'te',
    name: 'Telugu',
    scriptLabel: 'తెలుగు',
    demos: [
      {
        title: "Standard Telugu",
        display_text: "Tomorrow I am going out of town.",
        actual_text: "రేపు నేను పట్టణం బయటికి వెళ్తున్నాను, మత ఘర్షణల గురించి ఆందోళనగా ఉంది.",
        type: "Normal"
      }
    ]
  },
  {
    id: 'ur',
    name: 'Urdu',
    scriptLabel: 'اردو',
    demos: [
      {
        title: "Standard Urdu",
        display_text: "I feel growing concern about GST policy changes.",
        actual_text: "مجھے جی ایس ٹی پالیسی میں تبدیلی کے ممکنہ اثر کے بارے میں بڑھتے خوف کا احساس ہو رہا ہے۔",
        type: "Normal"
      }
    ]
  }
];
