// js/modules/print.js - 인쇄 기능 모듈

const PrintModule = {

    sanitizeFileNamePart(value) {
        const sanitized = String(value || '')
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[. ]+$/g, '')
            .trim();
        return sanitized || '거래처';
    },

    getPdfDocumentTitle(tab, row, today = getToday()) {
        const labels = {
            quotes: '견적서',
            sales: '거래명세서',
            rentals: '대여확인증'
        };
        if (!labels[tab]) return '';

        const date = parseDateString(today);
        const shortDate = `${String(date.year).slice(-2)}.${String(date.month).padStart(2, '0')}.${String(date.day).padStart(2, '0')}`;
        const partnerName = this.sanitizeFileNamePart(row.partner_name);
        return `[${shortDate}] ${partnerName}_${labels[tab]}`;
    },

    printPreparedDocument(tab, row) {
        const printContainer = document.getElementById('printContainer');
        const originalTitle = document.title;
        const pdfTitle = this.getPdfDocumentTitle(tab, row);

        if (pdfTitle) document.title = pdfTitle;
        printContainer.classList.remove('hidden');

        setTimeout(() => {
            try {
                window.print();
            } finally {
                printContainer.classList.add('hidden');
                document.title = originalTitle;
            }
        }, 100);
    },
    
    /**
     * 문서 인쇄
     */
    async print(tab, dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');

        if (tab === 'rentals') {
            this.prepareRentalDocument(row);
            this.printPreparedDocument(tab, row);
            return;
        }
        
        const isPO = (tab === 'purchase_orders');
        
        // 주소 행 표시/숨김 (견적서는 주소 숨김)
        const addrRow1 = document.getElementById('print_row_addr_1');
        const addrRow2 = document.getElementById('print_row_addr_2');
        
        if (tab === 'quotes') {
            if (addrRow1) addrRow1.style.display = 'none';
            if (addrRow2) addrRow2.style.display = 'none';
        } else {
            if (addrRow1) addrRow1.style.display = 'table-row';
            if (addrRow2) addrRow2.style.display = 'table-row';
        }
        
        // 제목 설정
        const titles = {
            quotes: { ko: '견적서', en: 'QUOTATION', prefix: 'Q' },
            orders: { ko: '주문서', en: 'ORDER SHEET', prefix: 'D' },
            sales: { ko: '거래명세서', en: 'TRANSACTION STATEMENT', prefix: 'T' },
            purchase_orders: { ko: '발주서', en: 'PURCHASE ORDER', prefix: 'P' }
        };
        
        const titleInfo = titles[tab] || titles.sales;
        
        document.getElementById('p_title_ko').innerText = titleInfo.ko;
        document.getElementById('p_title_en').innerText = titleInfo.en;
        document.getElementById('p_date').innerText = row.date;
        
        // 문서번호 생성
        if (isPO && row.po_number && row.po_number.startsWith('ASPEC')) {
            document.getElementById('p_no').innerText = row.po_number;
        } else {
            const { count } = await supabaseClient
                .from(tab)
                .select('*', { count: 'exact', head: true })
                .eq('date', row.date)
                .lte('id', row.id);
            
            const d = new Date(row.date);
            const yymmdd = d.getFullYear().toString().slice(2) + 
                          String(d.getMonth() + 1).padStart(2, '0') + 
                          String(d.getDate()).padStart(2, '0');
            
            document.getElementById('p_no').innerText = `ASPEC-${yymmdd}-${titleInfo.prefix}${String(count).padStart(2, '0')}`;
        }
        
        // 거래처/공급자 정보 설정
        if (isPO) {
            document.getElementById('p_left_role').innerText = "수 주 처";
            document.getElementById('p_right_role').innerText = "발 주 처";
        } else {
            document.getElementById('p_left_role').innerText = "공 급 받 는 자";
            document.getElementById('p_right_role').innerText = "공 급 자";
        }
        
        document.getElementById('p_left_name').innerText = row.partner_name;
        document.getElementById('p_left_manager').innerText = row.partner_manager || '';
        document.getElementById('p_left_email').innerText = row.email || '';
        document.getElementById('p_left_phone').innerText = row.phone || '';
        document.getElementById('p_left_addr').innerText = row.partner_address || '';
        
        document.getElementById('p_right_name').innerText = "아스펙 (ASPEC)";
        document.getElementById('p_right_manager').innerText = "이창현 프로";
        document.getElementById('p_right_email').innerText = AppState.currentUserEmail;
        document.getElementById('p_right_mp').innerText = "010-5919-1810";
        
        // 품목 테이블 재구성
        this.buildItemsTable(row);
        
        // 인쇄 실행
        this.printPreparedDocument(tab, row);
    },

    prepareRentalDocument(row) {
        const partner = row.partner || {};
        const addrRow1 = document.getElementById('print_row_addr_1');
        const addrRow2 = document.getElementById('print_row_addr_2');

        if (addrRow1) addrRow1.style.display = 'table-row';
        if (addrRow2) addrRow2.style.display = 'table-row';

        document.getElementById('p_title_ko').innerText = '대여확인증';
        document.getElementById('p_title_en').innerText = 'RENTAL CONFIRMATION';
        document.getElementById('p_date').innerText = row.rental_date || '';
        document.getElementById('p_no').innerText = row.rental_no || '';

        document.getElementById('p_left_role').innerText = '대 여 받 는 업 체';
        document.getElementById('p_right_role').innerText = '대 여 하 는 업 체';
        document.getElementById('p_left_name').innerText = row.partner_name || partner.name || '';
        document.getElementById('p_left_manager').innerText = row.contact_name || partner.manager_name || '';
        document.getElementById('p_left_email').innerText = partner.email || '';
        document.getElementById('p_left_phone').innerText = row.contact_phone || partner.phone || '';
        document.getElementById('p_left_addr').innerText = row.partner_address || partner.address || '';

        document.getElementById('p_right_name').innerText = '아스펙 (ASPEC)';
        document.getElementById('p_right_manager').innerText = '이창현 프로';
        document.getElementById('p_right_email').innerText = AppState.currentUserEmail || '';
        document.getElementById('p_right_mp').innerText = '010-5919-1810';

        this.buildRentalItemsTable(row);
    },

    buildRentalItemsTable(row) {
        document.querySelector('.print-items-table').innerHTML = this.getRentalItemsTableHtml(row);
    },

    getRentalItemsTableHtml(row) {
        const items = row.rental_items || [];
        const statusLabels = {
            normal: '정상',
            damaged: '파손',
            lost: '분실',
            repair_needed: '수리필요',
            other: '기타'
        };
        const purposeLabels = {
            test: '테스트',
            demo: '데모',
            temporary_replacement: '임시대체',
            project: '프로젝트',
            other: '기타'
        };
        const purpose = row.rental_purpose === 'other' && row.rental_purpose_detail
            ? `기타: ${row.rental_purpose_detail}`
            : (purposeLabels[row.rental_purpose] || row.rental_purpose || '-');
        const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const returnedQuantity = items.reduce((sum, item) => sum + Number(item.returned_quantity || 0), 0);
        const itemRows = items.map((item, index) => {
            const quantity = Number(item.quantity || 0);
            const returned = Number(item.returned_quantity || 0);
            const modelMaker = [item.model_name, item.manufacturer].filter(Boolean).join(' / ') || '-';
            const serialAsset = [item.serial_number, item.asset_number].filter(Boolean).join(' / ') || '-';
            const condition = statusLabels[item.item_status] || item.item_status || '정상';
            const note = item.memo ? `${condition} / ${item.memo}` : condition;

            return `
                <tr class="items-row rental-print-row">
                    <td style="text-align:center">${index + 1}</td>
                    <td>${escapeHtml(item.item_name || '-')}</td>
                    <td>${escapeHtml(modelMaker)}</td>
                    <td>${escapeHtml(serialAsset)}</td>
                    <td style="text-align:center">${formatNumber(quantity)}</td>
                    <td style="text-align:center">${formatNumber(returned)}</td>
                    <td style="text-align:center; font-weight:bold">${formatNumber(Math.max(0, quantity - returned))}</td>
                    <td style="text-align:center">${escapeHtml(item.unit || 'EA')}</td>
                    <td>${escapeHtml(note)}</td>
                </tr>`;
        }).join('');
        const emptyRows = Array.from({ length: Math.max(0, 6 - items.length) }, () =>
            '<tr class="items-row rental-print-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
        ).join('');

        return `
            <colgroup>
                <col style="width:4%"><col style="width:18%"><col style="width:18%"><col style="width:17%">
                <col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:6%"><col style="width:13%">
            </colgroup>
            <thead><tr>
                <th>No</th><th>품목명</th><th>모델 / 제조사</th><th>S/N / 관리번호</th>
                <th>대여</th><th>회수</th><th>미회수</th><th>단위</th><th>상태 / 비고</th>
            </tr></thead>
            <tbody>${itemRows}${emptyRows}</tbody>
            <tfoot class="rental-print-footer">
                <tr><th colspan="4">수량 합계</th><td style="text-align:center; font-weight:bold">${formatNumber(totalQuantity)}</td><td style="text-align:center; font-weight:bold">${formatNumber(returnedQuantity)}</td><td style="text-align:center; font-weight:bold">${formatNumber(totalQuantity - returnedQuantity)}</td><td colspan="2"></td></tr>
                <tr><th colspan="2">대여 목적</th><td colspan="3">${escapeHtml(purpose)}</td><th colspan="2">회수예정일</th><td colspan="2">${escapeHtml(row.expected_return_date || '-')}</td></tr>
                <tr><th colspan="2">프로젝트 / 현장</th><td colspan="7">${escapeHtml(row.project_name || '-')}</td></tr>
                <tr><th colspan="2">비고</th><td colspan="7">${escapeHtml(row.memo || '-')}</td></tr>
                <tr class="rental-confirmation-row"><td colspan="9">상기 물품을 대여하였음을 확인합니다.<br><br>확인자: ______________________________</td></tr>
            </tfoot>`;
    },
    
    /**
     * 품목 테이블 구성
     */
    buildItemsTable(row) {
        const tableContainer = document.querySelector('.print-items-table');
        
        tableContainer.innerHTML = `
            <colgroup>
                <col style="width: 5%;">
                <col style="width: 25%;">
                <col style="width: 30%;">
                <col style="width: 8%;">
                <col style="width: 8%;">
                <col style="width: 12%;">
                <col style="width: 12%;">
            </colgroup>
            <thead>
                <tr>
                    <th>No</th><th>품명</th><th>규격</th><th>단위</th><th>수량</th><th>단가</th><th>공급가액</th>
                </tr>
            </thead>
            <tbody id="p_tbody"></tbody>
            <tfoot>
                <tr style="background: #f8f8f8;">
                    <td colspan="4" style="text-align: center; border-right: 1px solid black; font-weight: bold;">합 계 (Total)</td>
                    <td style="text-align: center; border-right: 1px solid black; font-weight: bold;" id="p_total_qty"></td>
                    <td style="text-align: right; border-right: 1px solid black; font-size: 11px;">공급가액</td>
                    <td style="text-align: right; font-weight: bold;" id="p_sum_supply"></td>
                </tr>
                <tr>
                    <td colspan="5" style="border-right: 1px solid black; border-bottom: 1px solid black;"></td>
                    <td style="text-align: right; border-right: 1px solid black; background: #f8f8f8; font-size: 11px;">부가세 (VAT)</td>
                    <td style="text-align: right;" id="p_sum_vat"></td>
                </tr>
                <tr style="font-weight: bold;">
                    <td colspan="5" style="border-right: 1px solid black; border-bottom: 1px solid black;"></td>
                    <td style="text-align: right; border-right: 1px solid black; background: #e6e6e6;">총 합계</td>
                    <td style="text-align: right; background: #e6e6e6;" id="p_total_amt"></td>
                </tr>
                <tr style="background: #fff; border-top: 2px double black;">
                    <td colspan="7" style="padding: 10px; text-align: left;">
                        <strong>[비고]</strong> <span id="p_note"></span>
                    </td>
                </tr>
            </tfoot>`;
        
        const tbody = document.getElementById('p_tbody');
        let sumQty = 0, sumAmt = 0;
        
        if (row.items) {
            row.items.forEach((item, idx) => {
                let spec = item.spec;
                if (!spec) {
                    const prod = AppState.productList.find(p => p.name === item.name);
                    if (prod) spec = prod.spec;
                }
                
                sumQty += parseInt(item.qty) || 0;
                sumAmt += parseInt(item.supply) || 0;
                
                tbody.innerHTML += `
                    <tr class="items-row">
                        <td style="text-align:center">${idx + 1}</td>
                        <td>${item.name}</td>
                        <td style="font-size:10px">${spec || '-'}</td>
                        <td style="text-align:center">${item.unit || 'EA'}</td>
                        <td style="text-align:center">${item.qty}</td>
                        <td style="text-align:right">${formatNumber(item.price)}</td>
                        <td style="text-align:right">${formatNumber(item.supply)}</td>
                    </tr>`;
            });
        }
        
        // 빈 행 추가 (최소 10행)
        const emptyRows = 10 - (row.items?.length || 0);
        for (let i = 0; i < emptyRows; i++) {
            tbody.innerHTML += `<tr class="items-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
        }
        
        const vatAmt = Math.floor(sumAmt * 0.1);
        const totalAmt = row.total_amount || (sumAmt + vatAmt);
        
        document.getElementById('p_total_qty').innerText = formatNumber(sumQty);
        document.getElementById('p_sum_supply').innerText = formatNumber(sumAmt);
        document.getElementById('p_sum_vat').innerText = formatNumber(vatAmt);
        document.getElementById('p_total_amt').innerText = "₩ " + formatNumber(totalAmt);
        document.getElementById('p_note').innerText = row.note || '';
    }
};

// 전역 함수 연결
function printDocument(tab, dataId) {
    PrintModule.print(tab, dataId);
}
