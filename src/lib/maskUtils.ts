/**
 * Tools for masks and CPF/CNPJ validation
 */

export const onlyDigits = (v: string): string => v.replace(/\D/g, '');

export const formatCPF = (value: string): string => {
	const d = onlyDigits(value).slice(0, 11);
	if (!d) return '';
	if (d.length <= 3) return d;
	if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, '$1.$2');
	if (d.length <= 9) return d.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
	return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
};

export const formatCNPJ = (value: string): string => {
	const d = onlyDigits(value).slice(0, 14);
	if (!d) return '';
	if (d.length <= 2) return d;
	if (d.length <= 5) return d.replace(/(\d{2})(\d+)/, '$1.$2');
	if (d.length <= 8) return d.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
	if (d.length <= 12) return d.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
	return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
};

export const formatDocument = (value: string): string => {
	const d = onlyDigits(value);
	return d.length > 11 ? formatCNPJ(d) : formatCPF(d);
};

export const formatPhone = (value: string): string => {
	const d = onlyDigits(value).slice(0, 11);
	if (!d) return '';
	if (d.length <= 2) return d;
	if (d.length <= 6) return d.replace(/(\d{2})(\d+)/, '($1) $2');
	if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
	return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

export const formatAgency = (value: string): string => {
	const d = onlyDigits(value).slice(0, 5);
	if (!d) return '';
	if (d.length <= 4) return d;
	return `${d.slice(0, 4)}-${d.slice(4)}`;
};

export const formatBankAccount = (value: string): string => {
	const d = onlyDigits(value).slice(0, 12);
	if (!d) return '';
	if (d.length <= 4) return d;
	return `${d.slice(0, d.length - 1)}-${d.slice(-1)}`;
};

export const formatCurrencyInput = (value: string): string => {
	if (!value) return 'R$ 0,00';
	const numbersOnly = onlyDigits(value);
	if (numbersOnly === '') return 'R$ 0,00';
	const cents = parseInt(numbersOnly, 10) || 0;
	const reais = cents / 100;
	return new Intl.NumberFormat('pt-BR', {
		style: 'currency',
		currency: 'BRL',
	}).format(reais);
};

export const parseCurrencyString = (value: string): number => {
	if (!value) return 0;
	const cleanValue = value.replace(/[R$\s]/g, '');
	const numbersOnly = cleanValue.replace(/[^\d,]/g, '');
	if (numbersOnly.includes(',')) {
		const parts = numbersOnly.split(',');
		const integerPart = parts[0] || '0';
		const decimalPart = parts[1] ? parts[1].slice(0, 2).padEnd(2, '0') : '00';
		return parseFloat(`${integerPart}.${decimalPart}`);
	}
	const numValue = parseInt(numbersOnly, 10) || 0;
	return numValue / 100;
};

export default {
	onlyDigits,
	formatCPF,
	formatCNPJ,
	formatDocument,
	formatPhone,
	formatAgency,
	formatBankAccount,
	formatCurrencyInput,
	parseCurrencyString,
};
