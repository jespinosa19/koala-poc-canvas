const pseudo =
  "before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"

export const hitBox = `relative ${pseudo} before:size-10 pointer-coarse:before:size-11`

export const hitX = `relative ${pseudo} before:h-10 before:w-full pointer-coarse:before:h-11 pointer-coarse:before:min-w-11`

export const hitY = `relative ${pseudo} before:h-10 before:w-full pointer-coarse:before:h-11`

export const hitCoarse = `relative ${pseudo} before:size-full pointer-coarse:before:min-h-11 pointer-coarse:before:min-w-11`

export const hitBoxPositioned = `${pseudo} before:size-10 pointer-coarse:before:size-11`
