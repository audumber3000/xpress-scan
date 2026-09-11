import { toFDI, fromFDI, formatSurfaces, planItemTeeth, withStatus, procedureChargeDesc } from '../src/shared/utils/teeth';

describe('tooth numbers', () => {
  it('shows stored Universal numbers as FDI, like the web and the PDFs', () => {
    expect(toFDI(3)).toBe('16');
    expect(toFDI('30')).toBe('46');
    expect(toFDI(8)).toBe('11');
  });

  it('reads a typed FDI number back to the Universal number to store', () => {
    expect(fromFDI('16')).toBe(3);
    expect(fromFDI(' 48 ')).toBe(32);
    expect(fromFDI('3')).toBeNull();     // not an FDI tooth
    expect(fromFDI('')).toBeNull();
  });
});

describe('surfaces', () => {
  it('names them for the tooth: incisal and palatal where they apply', () => {
    expect(formatSurfaces(3, ['O', 'M'])).toBe('MO');
    expect(formatSurfaces(9, ['D', 'O'])).toBe('ID');   // upper incisor
    expect(formatSurfaces(3, ['L'])).toBe('P');         // upper molar
    expect(formatSurfaces(30, ['L'])).toBe('L');        // lower molar
  });
});

describe('plan items', () => {
  it('labels a combined procedure with every tooth, not "General"', () => {
    expect(planItemTeeth({ tooth: null, teeth: [23, 24, 25] })).toBe('32, 31, 41');
    expect(planItemTeeth({ tooth: 3, surfaces: ['M', 'O'] })).toBe('16 (MO)');
    expect(planItemTeeth({ tooth: null })).toBe('');
  });

  it('bills with the same words as the web', () => {
    expect(procedureChargeDesc({ procedure: 'Composite', tooth: 3, surfaces: ['M', 'O'] })).toBe('Composite (Tooth #16, MO)');
    expect(procedureChargeDesc({ procedure: 'Scaling', tooth: null, teeth: [23, 24] })).toBe('Scaling (Teeth #32, 31)');
    expect(procedureChargeDesc({ procedure: 'Consultation', tooth: null })).toBe('Consultation (Tooth #General)');
  });
});

describe('withStatus', () => {
  it('writes the web fields with the status, so the web sees the change', () => {
    expect(withStatus({ condition: 'sound', work: 'planned', status: 'planned' }, 'missing'))
      .toMatchObject({ status: 'missing', condition: 'missing', work: null, workType: null });
    expect(withStatus({}, 'existing')).toMatchObject({ status: 'existing', work: 'existing', workType: 'filling' });
  });

  it('keeps a recorded fracture when work is added', () => {
    expect(withStatus({ condition: 'fractured', status: 'fractured' }, 'planned'))
      .toMatchObject({ status: 'planned', condition: 'fractured', work: 'planned' });
  });

  it('keeps everything else on the tooth', () => {
    const out = withStatus({ conditions: ['caries'], marks: ['abscess'], surfaces: { O: 'caries' } }, 'present');
    expect(out.conditions).toEqual(['caries']);
    expect(out.marks).toEqual(['abscess']);
    expect(out.surfaces).toEqual({ O: 'caries' });
  });
});
