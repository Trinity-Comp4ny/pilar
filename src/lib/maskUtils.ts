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

export default {
	onlyDigits,
	formatCPF,
	formatCNPJ,
	formatDocument,
	formatPhone,
};
