// Global variables
let selectedFile = null;
let compressedPdfBytes = null;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultSection = document.getElementById('resultSection');
const fileName = document.getElementById('fileName');
const originalSize = document.getElementById('originalSize');
const originalSizeResult = document.getElementById('originalSizeResult');
const compressedSize = document.getElementById('compressedSize');
const savings = document.getElementById('savings');
const compressBtn = document.getElementById('compressBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const qualitySlider = document.getElementById('qualitySlider');

// Event Listeners
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
compressBtn.addEventListener('click', compressPDF);
downloadBtn.addEventListener('click', downloadCompressedPDF);
resetBtn.addEventListener('click', resetApp);

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        handleFile(files[0]);
    } else {
        alert('Please drop a PDF file');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        handleFile(file);
    } else {
        alert('Please select a PDF file');
    }
}

function handleFile(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    originalSize.textContent = formatFileSize(file.size);

    // Show processing section and hide upload section
    uploadSection.classList.add('hidden');
    processingSection.classList.remove('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function compressPDF() {
    if (!selectedFile) return;

    // Disable compress button
    compressBtn.disabled = true;
    compressBtn.textContent = 'Compressing...';

    // Show progress
    progressContainer.classList.remove('hidden');
    updateProgress(10, 'Loading PDF...');

    try {
        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Read the file
        const arrayBuffer = await selectedFile.arrayBuffer();
        updateProgress(20, 'Analyzing PDF...');

        // Load the PDF with pdf.js
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        updateProgress(30, 'Preparing compression...');

        // Get compression level from slider
        const compressionLevel = parseInt(qualitySlider.value);

        // Determine quality and scale based on compression level
        // Level 1 (Low): High quality, minimal compression
        // Level 2 (Medium): Medium quality, moderate compression
        // Level 3 (High): Low quality, maximum compression
        const qualitySettings = {
            1: { scale: 1.5, quality: 0.92, dpi: 150 },
            2: { scale: 1.2, quality: 0.75, dpi: 120 },
            3: { scale: 1.0, quality: 0.60, dpi: 96 }
        };

        const settings = qualitySettings[compressionLevel];

        // Create new PDF with jsPDF
        const { jsPDF } = window.jspdf;

        // Get first page to determine dimensions
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1.0 });

        // Create PDF with correct dimensions (in mm)
        const pdfWidthMM = viewport.width * 0.264583; // Convert px to mm
        const pdfHeightMM = viewport.height * 0.264583;

        const compressedPdf = new jsPDF({
            orientation: pdfWidthMM > pdfHeightMM ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pdfWidthMM, pdfHeightMM],
            compress: true
        });

        // Process each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            updateProgress(30 + (pageNum / numPages) * 60, `Compressing page ${pageNum} of ${numPages}...`);

            const page = await pdf.getPage(pageNum);
            const pageViewport = page.getViewport({ scale: settings.scale });

            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = pageViewport.width;
            canvas.height = pageViewport.height;

            // Render PDF page to canvas
            await page.render({
                canvasContext: context,
                viewport: pageViewport
            }).promise;

            // Convert canvas to compressed image
            const imgData = canvas.toDataURL('image/jpeg', settings.quality);

            // Add page to new PDF (skip first page as it's already created)
            if (pageNum > 1) {
                compressedPdf.addPage([pdfWidthMM, pdfHeightMM], pdfWidthMM > pdfHeightMM ? 'landscape' : 'portrait');
            }

            // Add image to PDF page
            compressedPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMM, pdfHeightMM, undefined, 'FAST');
        }

        updateProgress(95, 'Finalizing...');

        // Generate compressed PDF
        const pdfBytes = compressedPdf.output('arraybuffer');
        compressedPdfBytes = new Uint8Array(pdfBytes);

        updateProgress(100, 'Complete!');

        // Calculate compression ratio
        const originalSizeBytes = selectedFile.size;
        const compressedSizeBytes = compressedPdfBytes.length;
        const savedBytes = originalSizeBytes - compressedSizeBytes;
        const savedPercentage = Math.round((savedBytes / originalSizeBytes) * 100);

        // Show results
        setTimeout(() => {
            showResults(originalSizeBytes, compressedSizeBytes, savedPercentage);
        }, 500);

    } catch (error) {
        console.error('Compression error:', error);
        alert('An error occurred while compressing the PDF. Please try again with a different file or compression level.');
        compressBtn.disabled = false;
        compressBtn.textContent = 'Compress PDF';
        progressContainer.classList.add('hidden');
    }
}

function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

function showResults(originalSizeBytes, compressedSizeBytes, savedPercentage) {
    processingSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    originalSizeResult.textContent = formatFileSize(originalSizeBytes);
    compressedSize.textContent = formatFileSize(compressedSizeBytes);

    if (savedPercentage > 0) {
        savings.textContent = `You saved ${savedPercentage}% (${formatFileSize(originalSizeBytes - compressedSizeBytes)})`;
    } else {
        savings.textContent = 'File is already optimized';
    }
}

function downloadCompressedPDF() {
    if (!compressedPdfBytes) return;

    // Create blob and download
    const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name.replace('.pdf', '_compressed.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function resetApp() {
    // Reset all variables
    selectedFile = null;
    compressedPdfBytes = null;
    fileInput.value = '';

    // Reset UI
    uploadSection.classList.remove('hidden');
    processingSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    progressContainer.classList.add('hidden');

    // Reset button state
    compressBtn.disabled = false;
    compressBtn.textContent = 'Compress PDF';

    // Reset progress
    progressFill.style.width = '0%';
    progressText.textContent = 'Compressing...';

    // Reset slider
    qualitySlider.value = 2;
}
