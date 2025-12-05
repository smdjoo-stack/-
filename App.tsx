import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Calendar, Clipboard, Check, Sparkles, Send, Upload, File as FileIcon, X, Users, MessageCircle } from 'lucide-react';
import { SermonInfo, FileData } from './types';
import { InputGroup } from './components/InputGroup';
import { generateProposalFromGemini } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

// Constants for Dropdowns
const DEPARTMENTS = [
  "영아부 (0-3세)",
  "유치부 (4-7세)",
  "영유아부 (0-7세 통합)",
  "초등부 (1-3학년)",
  "초등부 (4-6학년)",
  "초등부 (1-6학년 통합)",
  "중등부",
  "고등부",
  "청년부",
  "기타 (직접 입력)"
];

const CONTENTS = [
  "인물별 설교 (Character-based)",
  "사건별 설교 (Event-based)",
  "주제별 설교 (Topic-based)",
  "절기별 설교 (Season-based)",
  "혼합형 (Mixed)",
  "강해 설교 (Expository)"
];

const FREQUENCIES = [
  "1주 (단회)",
  "4주 (1개월)",
  "10주",
  "12주 (3개월)",
  "26주 (6개월)",
  "48주",
  "52주 (1년)",
  "기타 (직접 입력)"
];

const App: React.FC = () => {
  const [sermonInfo, setSermonInfo] = useState<SermonInfo>({
    department: '',
    customDepartment: '',
    contentType: '',
    contentDetail: '',
    frequency: '',
    customFrequency: '',
    theme: '',
    scriptureReference: '',
  });

  const [attachedFile, setAttachedFile] = useState<FileData | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [proposalResult, setProposalResult] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSermonInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert('파일 크기는 20MB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(',')[1];
      setAttachedFile({
        name: file.name,
        mimeType: file.type,
        data: base64String
      });
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Construct the prompt automatically
  useEffect(() => {
    const targetDept = sermonInfo.department === '기타 (직접 입력)' 
      ? sermonInfo.customDepartment 
      : sermonInfo.department;

    const targetFreq = sermonInfo.frequency === '기타 (직접 입력)' 
      ? sermonInfo.customFrequency 
      : sermonInfo.frequency;

    let prompt = `
당신은 교회학교 교육 전문가이자 탁월한 설교 기획자입니다.
다음 정보를 바탕으로 교회학교 부서를 위한 체계적이고 은혜로운 **설교 계획서**를 작성해주세요.

## 1. 기본 정보
- **대상 부서**: ${targetDept || '(미선택)'}
- **설교 기간/횟수**: ${targetFreq || '(미선택)'}

## 2. 설교 방향성
- **설교 유형**: ${sermonInfo.contentType || '(미선택)'}
- **중점 세부 내용**: ${sermonInfo.contentDetail || '(내용 없음 - AI가 적절히 추천해주세요)'}
- **주제/강조점**: ${sermonInfo.theme || '(없음)'}
`;

    if (attachedFile) {
      prompt += `
[중요] 첨부된 PDF 파일(공과 커리큘럼, 교회 연간 계획 등)을 분석하여, 해당 내용과 흐름이 일치하도록 설교 계획을 구성해주세요.
`;
    }

    prompt += `
## 3. 작성 요청 사항
1. **대상 눈높이 고려**: ${targetDept}의 발달 단계와 이해도를 고려하여 설교 제목과 본문을 선정해주세요.
2. **구체적 구성**: 단순한 나열이 아니라, 설교의 흐름이 이어지도록 구성해주세요.
3. **적용점 포함**: 아이들의 삶에 실제적으로 적용할 수 있는 포인트(Application)를 포함해주세요.
4. **활동 제안**: 설교 후 2부 순서나 분반 공부에서 할 수 있는 간단한 활동 아이디어를 포함해주세요.

## 4. 출력 형식 (Markdown Table)
반드시 아래와 같은 **표(Table)** 형식으로 작성해주세요.

| 주차 | 날짜(월/주) | 설교 제목 | 성경 본문 | 핵심 주제 (One Message) | 2부 활동/적용 아이디어 |
|:---:|:---:|---|---|---|---|
| 1주 | 1월 1주 | ... | ... | ... | ... |

톤앤매너: 따뜻하고 격려가 되며, 교육적인 전문성이 느껴지는 어조.
    `.trim();
    setGeneratedPrompt(prompt);
  }, [sermonInfo, attachedFile]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    if (!sermonInfo.department || !sermonInfo.frequency) {
      alert("부서와 설교 횟수는 필수 선택 사항입니다.");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateProposalFromGemini(generatedPrompt, attachedFile || undefined);
      setProposalResult(result);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      alert("설교 계획 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">교회학교 설교계획 프롬프트 생성기</h1>
            <p className="text-xs text-slate-500">다음 세대를 위한 맞춤형 설교 큐레이션</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Inputs (Span 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Basic Info */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <Users size={18} className="text-indigo-600" />
              <h2 className="font-semibold text-slate-800">1. 기본 정보 (대상 및 기간)</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputGroup 
                label="부서 선택" 
                name="department" 
                type="select" 
                value={sermonInfo.department} 
                onChange={handleInfoChange} 
                options={DEPARTMENTS}
                required
              />
              <InputGroup 
                label="설교 횟수/기간" 
                name="frequency" 
                type="select" 
                value={sermonInfo.frequency} 
                onChange={handleInfoChange} 
                options={FREQUENCIES}
                required
              />

              {sermonInfo.department === '기타 (직접 입력)' && (
                <div className="md:col-span-2 animate-fadeIn">
                  <InputGroup 
                    label="부서명/연령 입력 (예: 노년부, 70대 이상)" 
                    name="customDepartment" 
                    value={sermonInfo.customDepartment} 
                    onChange={handleInfoChange} 
                    placeholder="대상을 구체적으로 입력하세요"
                  />
                </div>
              )}

              {sermonInfo.frequency === '기타 (직접 입력)' && (
                <div className="md:col-span-2 animate-fadeIn">
                  <InputGroup 
                    label="기간 직접 입력 (예: 여름성경학교 3일, 특별새벽기도 1주)" 
                    name="customFrequency" 
                    value={sermonInfo.customFrequency} 
                    onChange={handleInfoChange} 
                    placeholder="기간이나 횟수를 구체적으로 입력하세요"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Content Details */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <MessageCircle size={18} className="text-indigo-600" />
              <h2 className="font-semibold text-slate-800">2. 설교 내용 및 방향</h2>
            </div>
            <div className="p-6 space-y-4">
              <InputGroup 
                label="설교 내용 분류" 
                name="contentType" 
                type="select" 
                value={sermonInfo.contentType} 
                onChange={handleInfoChange} 
                options={CONTENTS}
              />
              
              <InputGroup 
                label="세부 사항 입력" 
                name="contentDetail" 
                value={sermonInfo.contentDetail} 
                onChange={handleInfoChange} 
                placeholder="예: 다윗의 일생, 출애굽기 여정, 추수감사절, 예수님의 비유, 십계명 등" 
                type="text"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup 
                  label="핵심 주제/키워드 (선택)" 
                  name="theme" 
                  value={sermonInfo.theme} 
                  onChange={handleInfoChange} 
                  placeholder="예: 순종, 믿음, 사랑, 친구 관계" 
                />
                 <InputGroup 
                  label="참고 성경 범위 (선택)" 
                  name="scriptureReference" 
                  value={sermonInfo.scriptureReference} 
                  onChange={handleInfoChange} 
                  placeholder="예: 마태복음 5-7장, 시편 전체" 
                />
              </div>
            </div>
          </section>

          {/* Section 3: File Upload */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <Upload size={18} className="text-indigo-600" />
              <h2 className="font-semibold text-slate-800">3. 참고 자료 첨부 (PDF)</h2>
            </div>
            <div className="p-6">
              <div className="mb-2 text-sm text-slate-600">
                교회 커리큘럼, 공과 목차, 혹은 연간 목회 계획서(PDF)가 있다면 첨부해주세요. 
              </div>
              
              {!attachedFile ? (
                <div 
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileIcon className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-slate-600 font-medium text-sm">클릭하여 PDF 업로드</p>
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={handleFileChange} 
                    className="hidden" 
                    ref={fileInputRef}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-white p-2 rounded shadow-sm">
                      <FileIcon className="text-red-500 h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 text-sm truncate">{attachedFile.name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={removeFile}
                    className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Prompt & Action (Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-100px)] sticky top-24">
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-yellow-400" />
                <h2 className="font-semibold">프롬프트 미리보기</h2>
              </div>
              <button 
                onClick={copyToClipboard}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${copied ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                {copied ? <Check size={14} /> : <Clipboard size={14} />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            
            <div className="p-4 flex-grow overflow-y-auto bg-slate-100">
              <div className="bg-white border border-slate-200 text-slate-700 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap leading-relaxed shadow-sm">
                {generatedPrompt}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200">
               <button
                onClick={handleGenerate}
                disabled={isGenerating || !sermonInfo.department}
                className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                  isGenerating || !sermonInfo.department
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                }`}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    설교 계획 생성 중...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    AI 설교 계획 생성하기
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Full Width Result Area */}
        {proposalResult && (
          <div className="lg:col-span-12 pt-4 border-t border-slate-200" ref={resultRef}>
            <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
               <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex justify-between items-center text-white">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Calendar size={20} className="text-white" />
                  생성된 설교 계획
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                       navigator.clipboard.writeText(proposalResult);
                       alert('결과물이 복사되었습니다.');
                    }}
                    className="flex items-center gap-1 text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Clipboard size={16} /> 전체 복사
                  </button>
                </div>
              </div>
              <div className="p-8 prose prose-slate prose-headings:text-indigo-900 prose-th:bg-slate-100 prose-th:p-3 prose-td:p-3 max-w-none bg-white">
                <ReactMarkdown>{proposalResult}</ReactMarkdown>
              </div>
            </section>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;